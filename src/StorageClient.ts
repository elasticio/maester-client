/* eslint-disable no-continue */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { promisify } from 'util';
import http from 'http';
import https from 'https';
import { Readable } from 'stream';
import { sign } from 'jsonwebtoken';
import { getMimeType } from 'stream-mime-type';
import log from './logger';
import {
  JwtNotProvidedError,
  ObjectStorageClientError,
  ServerTransportError,
} from './errors';
import { isEmptyObject, sleep } from './utils';
import {
  JWTPayload, RequestHeaders, RetryOptions, ReqWithBodyOptions, ObjectHeaders,
  StreamBasedRequestConfig, ReqOptions, searchObjectCriteria
} from './interfaces';

const REQUEST_MAX_RETRY = process.env.REQUEST_MAX_RETRY ? parseInt(process.env.REQUEST_MAX_RETRY, 10) : 5;
const REQUEST_RETRY_DELAY = process.env.REQUEST_RETRY_DELAY ? parseInt(process.env.REQUEST_RETRY_DELAY, 10) : 5000; // 5s
const REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT ? parseInt(process.env.REQUEST_TIMEOUT, 10) : 10000; // 10s

export const getStreamWithContentType = async (getStream: () => Promise<Readable>): Promise<{ mime, stream }> => {
  const { mime = 'application/json', stream } = await getMimeType(await getStream(), { strict: true });
  return { mime, stream };
};

export class StorageClient {
  private api: AxiosInstance;

  private static httpAgent = new http.Agent({ keepAlive: true });

  private static httpsAgent = new https.Agent({ keepAlive: true });

  private readonly jwtSecret: string;

  public constructor(config: { uri: string; jwtSecret: string }) {
    this.api = axios.create({
      baseURL: config.uri,
      httpAgent: StorageClient.httpAgent,
      httpsAgent: StorageClient.httpsAgent,
      maxContentLength: Infinity,
      maxRedirects: 0,
    });
    this.jwtSecret = config.jwtSecret;
  }

  private async requestRetry(
    requestConfig: StreamBasedRequestConfig, { retriesCount = REQUEST_MAX_RETRY, retryDelay = REQUEST_RETRY_DELAY, requestTimeout = REQUEST_TIMEOUT }: RetryOptions
  ): Promise<AxiosResponse> {
    let currentRetries = 0;
    let res;
    let err;
    while (currentRetries < retriesCount) {
      err = null;
      res = null;
      try {
        const { axiosReqConfig, getFreshStream } = requestConfig;
        let bodyAsStream;
        if (getFreshStream) {
          const { mime, stream } = await getStreamWithContentType(getFreshStream);
          axiosReqConfig.headers['content-type'] = mime;
          bodyAsStream = stream;
          if (process.env.NODE_ENV === 'test') log.debug(bodyAsStream); // to insure it's new stream on each call (in unit tests only)
        }
        res = await this.api.request({ ...axiosReqConfig, data: bodyAsStream, timeout: requestTimeout });
      } catch (e) {
        if (e instanceof ObjectStorageClientError) {
          throw e;
        }
        err = e;
        if (err?.response?.status < 500) throw e; // The request was made and the server responded with a status code
      }
      if ((err || res.status >= 500) && currentRetries < retriesCount) {
        log.warn({ err, status: res?.status, statusText: res?.statusText }, `Error during object request, retrying (${currentRetries + 1})`);
        await sleep(retryDelay);
        currentRetries++;
        continue;
      }
      break;
    }
    if (err || res?.status >= 500) {
      throw new ServerTransportError('Server error during request', {
        code: res?.status,
        cause: err
      });
    }
    return res;
  }

  private async formHeaders(jwtPayload: JWTPayload, override?: RequestHeaders) {
    if (isEmptyObject(jwtPayload) && !this.jwtSecret) {
      throw new JwtNotProvidedError('Neither JWT payload passed, nor JWT secret provided during initialization');
    }
    const token = isEmptyObject(jwtPayload)
      ? this.jwtSecret
      : await promisify(sign)(jwtPayload, this.jwtSecret);
    return { Authorization: `Bearer ${token}`, ...override };
  }

  // wrap for 'post' and 'put' methods
  private async reqWithBody(
    getFreshStream: () => Promise<Readable>,
    { ttl, override = {}, jwtPayload = {}, retryOptions = {} }: ReqWithBodyOptions = {},
    objectId?: string
  ) {
    if (ttl) override[ObjectHeaders.ttl] = ttl;
    return this.requestRetry({
      getFreshStream,
      axiosReqConfig: {
        method: objectId ? 'put' : 'post',
        url: objectId ? `/objects/${objectId}` : '/objects',
        headers: await this.formHeaders(jwtPayload, override)
      },
    }, retryOptions);
  }

  public async post(
    getFreshStream: () => Promise<Readable>,
    reqWithBodyOptions?: ReqWithBodyOptions
  ) {
    return this.reqWithBody(getFreshStream, reqWithBodyOptions);
  }

  public async put(
    objectId: string,
    getFreshStream: () => Promise<Readable>,
    reqWithBodyOptions?: ReqWithBodyOptions
  ) {
    return this.reqWithBody(getFreshStream, reqWithBodyOptions, objectId);
  }

  /**
   * fetches object(s) from maester by id/params
   * @param searchCriteria objectId/request-params
   */
  public async get(
    searchCriteria: searchObjectCriteria,
    { jwtPayload = {}, retryOptions = {} }: ReqOptions
  ): Promise<any> {
    const byId = typeof searchCriteria === 'string';
    return this.requestRetry({
      axiosReqConfig: {
        method: 'get',
        url: byId ? `/objects/${searchCriteria}` : '/objects',
        responseType: 'stream',
        params: byId ? {} : searchCriteria,
        headers: await this.formHeaders(jwtPayload)
      }
    }, retryOptions);
  }

  /**
   * delete object(s) from maester by id/params
   * @param searchCriteria objectId/request-params
   */
  public async delete(
    searchCriteria: searchObjectCriteria,
    { jwtPayload = {}, retryOptions = {} }: ReqOptions
  ) {
    const byId = typeof searchCriteria === 'string';
    return this.requestRetry({
      axiosReqConfig: {
        method: 'delete',
        url: byId ? `/objects/${searchCriteria}` : '/objects',
        params: byId ? {} : searchCriteria,
        headers: await this.formHeaders(jwtPayload)
      }
    }, retryOptions);
  }
}
