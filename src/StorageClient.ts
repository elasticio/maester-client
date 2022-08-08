/* eslint-disable no-continue */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { promisify } from 'util';
import http from 'http';
import https from 'https';
import { Readable } from 'stream';
import { sign } from 'jsonwebtoken';
import { getMimeType } from 'stream-mime-type';
import { exponentialSleep } from '@elastic.io/component-commons-library/dist/src/externalApi';
import log from './logger';
import {
  JwtNotProvidedError,
  ObjectStorageClientError,
  ServerTransportError,
  ClientTransportError
} from './errors';
import { validateAndGetRetryOptions } from './utils';
import {
  JWTPayload, reqWithBodyHeaders, RetryOptions, ReqWithBodyOptions,
  StreamBasedRequestConfig, ReqOptions, searchObjectCriteria, CONTENT_TYPE_HEADER
} from './interfaces';

export const getStreamWithContentType = async (getStream: () => Promise<Readable>): Promise<{ mime, stream }> => {
  const { mime = 'application/json', stream } = await getMimeType(await getStream(), { strict: true });
  return { mime, stream };
};

export class StorageClient {
  private api: AxiosInstance;

  private static httpAgent = new http.Agent({ keepAlive: true });

  private static httpsAgent = new https.Agent({ keepAlive: true });

  private readonly jwtSecret: string;

  private readonly userAgent: string;

  public constructor(config: { uri: string; jwtSecret?: string, userAgent: string }) {
    this.api = axios.create({
      baseURL: config.uri,
      httpAgent: StorageClient.httpAgent,
      httpsAgent: StorageClient.httpsAgent,
      maxContentLength: Infinity,
      maxRedirects: 0
    });
    this.userAgent = config.userAgent;
    this.jwtSecret = config.jwtSecret;
  }

  private async requestRetry(
    requestConfig: StreamBasedRequestConfig, retryOptions: RetryOptions
  ): Promise<AxiosResponse> {
    const { retriesCount, requestTimeout } = validateAndGetRetryOptions(retryOptions);
    let currentRetries = 0;
    let res;
    let err;
    while (currentRetries <= retriesCount) {
      err = null;
      res = null;
      try {
        const { axiosReqConfig, getFreshStream } = requestConfig;
        let bodyAsStream;
        if (getFreshStream) {
          const { mime, stream } = await getStreamWithContentType(getFreshStream);
          if (!axiosReqConfig.headers[CONTENT_TYPE_HEADER]) axiosReqConfig.headers[CONTENT_TYPE_HEADER] = mime;
          bodyAsStream = stream;
        }
        res = await this.api.request({ ...axiosReqConfig, data: bodyAsStream, timeout: requestTimeout });
      } catch (e) {
        if (e instanceof ObjectStorageClientError) {
          throw e;
        }
        err = e;
        if (err?.response?.status < 500) throw new ClientTransportError(`Client error during request: ${err.message}`, err.response.status);
      }
      if ((err || res.status >= 500) && currentRetries < retriesCount) {
        log.warn({ err, status: res?.status, statusText: res?.statusText }, `Error during object request, retrying (${currentRetries + 1})`);
        await exponentialSleep(currentRetries);
        currentRetries++;
        continue;
      }
      break;
    }
    if (err || res?.status >= 500) {
      throw new ServerTransportError(`Server error during request: "${err?.message || 'unknown error'}"`, {
        code: res?.status,
        cause: err
      });
    }
    return res;
  }

  private async formHeaders(jwtPayloadOrToken: JWTPayload | string, headers?: reqWithBodyHeaders) {
    if (typeof jwtPayloadOrToken !== 'string' && !this.jwtSecret) {
      throw new JwtNotProvidedError('Neither JWT token passed, nor JWT secret provided during initialization');
    }
    const token = typeof jwtPayloadOrToken === 'string'
      ? jwtPayloadOrToken
      : await promisify(sign)(jwtPayloadOrToken, this.jwtSecret);
    return {
      Authorization: `Bearer ${token}`,
      'User-Agent': this.userAgent,
      ...headers
    };
  }

  // wrap for 'post' and 'put' methods
  private async reqWithBody(
    getFreshStream: () => Promise<Readable>,
    { headers = {}, jwtPayloadOrToken = this.jwtSecret, retryOptions = {} }: ReqWithBodyOptions = {},
    objectId?: string
  ) {
    return this.requestRetry({
      getFreshStream,
      axiosReqConfig: {
        method: objectId ? 'put' : 'post',
        url: objectId ? `/objects/${objectId}` : '/objects',
        headers: await this.formHeaders(jwtPayloadOrToken, headers)
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
    { jwtPayloadOrToken = this.jwtSecret, retryOptions = {} }: ReqOptions
  ): Promise<any> {
    const byId = typeof searchCriteria === 'string';
    return this.requestRetry({
      axiosReqConfig: {
        method: 'get',
        url: byId ? `/objects/${searchCriteria}` : '/objects',
        responseType: 'stream',
        params: byId ? {} : searchCriteria,
        headers: await this.formHeaders(jwtPayloadOrToken)
      }
    }, retryOptions);
  }

  /**
   * delete object(s) from maester by id/params
   * @param searchCriteria objectId/request-params
   */
  public async delete(
    searchCriteria: searchObjectCriteria,
    { jwtPayloadOrToken = this.jwtSecret, retryOptions = {} }: ReqOptions
  ) {
    const byId = typeof searchCriteria === 'string';
    return this.requestRetry({
      axiosReqConfig: {
        method: 'delete',
        url: byId ? `/objects/${searchCriteria}` : '/objects',
        params: byId ? {} : searchCriteria,
        headers: await this.formHeaders(jwtPayloadOrToken)
      }
    }, retryOptions);
  }
}
