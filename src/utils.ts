import { Readable } from 'stream';
import { uploadData, RetryOptions } from './interfaces';

const REQUEST_RETRY_DELAY = process.env.REQUEST_RETRY_DELAY ? parseInt(process.env.REQUEST_RETRY_DELAY, 10) : 5000; // 5s
const REQUEST_MAX_RETRY = process.env.REQUEST_MAX_RETRY ? parseInt(process.env.REQUEST_MAX_RETRY, 10) : 3;
const REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT ? parseInt(process.env.REQUEST_TIMEOUT, 10) : 10000; // 10s

export const sleep = async (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

// 'undefined' throws error, but 'null' is ok (as an option - convert 'undefined' to 'null')
export const streamFromData = async (data: uploadData): Promise<Readable> => {
  const dataString = JSON.stringify(data);
  const stream = new Readable();
  stream.push(dataString);
  stream.push(null);
  return stream;
};

/**
 * if values are higher or lower the limit - they'll be overwritten.
 * returns valid values for RetryOptions
 */
export const validateRetryOptions = ({
  retryDelay = REQUEST_RETRY_DELAY, retriesCount = REQUEST_MAX_RETRY, requestTimeout = REQUEST_TIMEOUT
}: RetryOptions): RetryOptions => {
  const retryDelay_MAX_LIMIT = 10000; // 10s
  const retryDelay_MIN_LIMIT = 0; // 0ms
  const retriesCount_MAX_LIMIT = 6;
  const retriesCount_MIN_LIMIT = 0;
  const requestTimeout_MAX_LIMIT = 20000; // 20s
  const requestTimeout_MIN_LIMIT = 500; // 500ms

  return {
    retryDelay: (retryDelay > retryDelay_MAX_LIMIT || retryDelay < retryDelay_MIN_LIMIT) ? REQUEST_RETRY_DELAY : retryDelay,
    retriesCount: (retriesCount > retriesCount_MAX_LIMIT || retriesCount < retriesCount_MIN_LIMIT) ? REQUEST_MAX_RETRY : retriesCount,
    requestTimeout: (requestTimeout > requestTimeout_MAX_LIMIT || requestTimeout < requestTimeout_MIN_LIMIT) ? REQUEST_TIMEOUT : requestTimeout
  };
};

export const getDelayTime = (retryDelay: number, currentReties: number): number => {
  const maxBackoff = 10000; // 10s
  return Math.min(retryDelay + (currentReties * 1000), maxBackoff);
};
