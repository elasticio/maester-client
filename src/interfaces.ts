import { Readable, Duplex } from 'stream';
import { AxiosRequestConfig } from 'axios';

export const TTL_HEADER = 'x-eio-ttl';
export const CONTENT_TYPE_HEADER = 'content-type';

export interface StreamBasedRequestConfig {
  getFreshStream?: () => Promise<Readable>;
  axiosReqConfig: AxiosRequestConfig;
}

export interface reqWithBodyHeaders {
  [TTL_HEADER]?: number;
  [CONTENT_TYPE_HEADER]?: string;
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
  retriesCount?: number; // values are validated with RETRIES_COUNT const below
  requestTimeout?: number; // values are validated with REQUEST_TIMEOUT const below
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

export const RETRIES_COUNT = {
  minValue: 0,
  defaultValue: process.env.REQUEST_MAX_RETRY ? parseInt(process.env.REQUEST_MAX_RETRY, 10) : 3, // times error will be retried
  maxValue: 4
} as const;
export const REQUEST_TIMEOUT = {
  minValue: 500,
  defaultValue: process.env.REQUEST_TIMEOUT ? parseInt(process.env.REQUEST_TIMEOUT, 10) : 10000, // 10s
  maxValue: 20000
} as const;
