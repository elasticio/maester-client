/* eslint-disable no-param-reassign */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-continue */
import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { promisify } from 'util';
import http from 'http';
import https from 'https';
import { Readable, Duplex } from 'stream';
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
import { JWTPayload, RequestHeaders, RetryOptions, ReqWithBodyOptions, ObjectHeaders, StreamBasedRequestConfig } from './interfaces';

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
      timeout: REQUEST_TIMEOUT,
    });
    this.jwtSecret = config.jwtSecret;
  }

  private async requestRetry(
    requestConfig: StreamBasedRequestConfig, { retriesCount = REQUEST_MAX_RETRY, retryDelay = REQUEST_RETRY_DELAY }: RetryOptions
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
        res = await this.api.request({ ...axiosReqConfig, data: bodyAsStreamInstance });
      } catch (e) {
        console.log('---------------------------------------------------------------------------------------------', currentRetries);
        if (e instanceof ObjectStorageClientError) {
          throw e;
        }
        err = e;
      }
      // last attempt error should not be logged
      if ((err || res.status >= 500) && currentRetries < retriesCount) {
        log.warn({ err, status: res?.status, statusText: res?.statusText }, 'Error during object request, retrying');
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
        console.log(11, err?.message);
        throw new ServerTransportError('Server error during request', {
          code: res?.status,
          cause: err
        });
      } else {
        throw new ClientTransportError(`Client error during request: ${res.data}`, res.status);
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

  private async reqWithBody(
    getFreshStream: () => Promise<Readable>,
    { contentType, ttl, jwtPayload = {}, retryOptions = {} }: ReqWithBodyOptions,
    objectId?: string
  ) {
    const headers: RequestHeaders = { 'content-type': contentType || 'application/octet-stream' };
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

  // public async get(objectId: string, reqOptions: ReqOptions) {
  //   const res = await this.requestRetry({

  //   });
  //   return res;
  // }
}
