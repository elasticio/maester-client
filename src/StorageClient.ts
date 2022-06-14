/* eslint-disable no-continue */
import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { promisify } from 'util';
import http from 'http';
import https from 'https';
import { Readable } from 'stream';
import { sign } from 'jsonwebtoken';
import log from './logger';
import {
  ClientTransportError,
  InternalError,
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
      validateStatus: null,
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
        const { axiosReqConfig, getFreshStream = async () => { } } = requestConfig;
        const bodyAsStreamInstance = await getFreshStream();
        res = await this.api.request({ ...axiosReqConfig, data: bodyAsStreamInstance, timeout: requestTimeout });
      } catch (e) {
        if (e instanceof ObjectStorageClientError) {
          throw e;
        }
        err = e;
      }
      // last attempt error should not be logged
      if ((err || res.status >= 500) && currentRetries < retriesCount) {
        log.warn({ err, status: res?.status, statusText: res?.statusText }, `Error during object request, retrying (${currentRetries + 1})`);
        await sleep(retryDelay);
        currentRetries++;
        continue;
      }
      break;
    }
    if (err || res.status >= 400) {
      if (err && !err.isAxiosError) {
        throw new InternalError('Internal library error', err);
      }
      if (err || res?.status >= 500) {
        console.log(err?.message);
        throw new ServerTransportError('Server error during request', {
          code: res?.status,
          cause: err
        });
      } else {
        throw new ClientTransportError(`Client error during request: ${JSON.stringify(res.data)}`, res.status);
      }
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
    { contentType, ttl, override = {}, jwtPayload = {}, retryOptions = {} }: ReqWithBodyOptions = {},
    objectId?: string
  ) {
    const headers: RequestHeaders = {
      'content-type': contentType || 'application/json',
      ...override
    };
    if (ttl) headers[ObjectHeaders.ttl] = ttl;
    return this.requestRetry({
      getFreshStream,
      axiosReqConfig: {
        method: objectId ? 'put' : 'post',
        url: objectId ? `/objects/${objectId}` : '/objects',
        headers: await this.formHeaders(jwtPayload, headers)
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
  ) {
    const axiosReqConfig: AxiosRequestConfig = {
      method: 'get',
      url: '/objects',
      responseType: 'stream',
      params: {},
      headers: await this.formHeaders(jwtPayload)
    };
    if (typeof searchCriteria === 'string') {
      axiosReqConfig.url += `/${searchCriteria}`;
    } else {
      axiosReqConfig.params = searchCriteria;
    }
    return this.requestRetry({ axiosReqConfig }, retryOptions);
  }

  public async delete(
    objectId: string,
    { jwtPayload = {}, retryOptions = {} }: ReqOptions
  ) {
    return this.requestRetry({
      axiosReqConfig: {
        method: 'delete',
        url: `/objects/${objectId}`,
        headers: await this.formHeaders(jwtPayload)
      }
    }, retryOptions);
  }
}
