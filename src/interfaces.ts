import { Readable, Duplex } from 'stream';
import { AxiosRequestConfig } from 'axios';

export interface StreamBasedRequestConfig {
  getFreshStream?: () => Promise<Readable>;
  axiosReqConfig: AxiosRequestConfig;
}

export enum ObjectHeaders {
  ttl = 'x-eio-ttl'
}

export interface reqWithBodyHeaders {
  ttl?: number;
  override?: RequestHeaders
}

export interface reqHeaders {
  responseType?: ResponseType;
}

export interface ReqOptions extends reqHeaders {
  jwtPayload?: JWTPayload;
  retryOptions?: RetryOptions;
}

export interface ReqWithBodyOptions extends reqWithBodyHeaders {
  jwtPayload?: JWTPayload;
  retryOptions?: RetryOptions;
}

export interface RetryOptions {
  retryDelay?: number;
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

export interface RequestHeaders {
  [index: string]: string | number;
}

export type searchObjectCriteria = string | object;

export type TransformMiddleware = () => Duplex;
export type ResponseType = 'stream' | 'json' | 'arraybuffer';
export const DEFAULT_RESPONSE_TYPE: ResponseType = 'json';
