import { Readable, Duplex } from 'stream';
import { AxiosRequestConfig } from 'axios';

export const TTL_HEADER = 'x-eio-ttl';

export interface StreamBasedRequestConfig {
  getFreshStream?: () => Promise<Readable>;
  axiosReqConfig: AxiosRequestConfig;
}

export interface reqWithBodyHeaders {
  [TTL_HEADER]?: number;
  'content-type'?: string;
  [index: `x-query-${string}`]: string | number
  [index: `x-meta-${string}`]: string | number
}

export interface reqHeaders {
  responseType?: ResponseType;
}

export interface ReqOptions extends reqHeaders {
  jwtPayloadOrToken?: JWTPayload | string;
  retryOptions?: RetryOptions;
}

export interface ReqWithBodyOptions {
  jwtPayloadOrToken?: JWTPayload | string;
  retryOptions?: RetryOptions;
  headers?: reqWithBodyHeaders
}

export interface RetryOptions {
  retriesCount?: number;
  requestTimeout?: number;
}

export interface JWTPayload {
  tenantId?: string,
  contractId?: string,
  workspaceId?: string,
  flowId?: string,
  userId?: string
}

export type searchObjectCriteria = string | object;
export type uploadData = string | object | number | Array<any>;
export type TransformMiddleware = () => Duplex;
export type ResponseType = 'stream' | 'json' | 'arraybuffer';
export const DEFAULT_RESPONSE_TYPE: ResponseType = 'json';
