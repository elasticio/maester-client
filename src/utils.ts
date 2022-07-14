import { Readable } from 'stream';
import { PotentiallyConsumedStreamError } from './errors';
import { uploadData, RetryOptions, RETRIES_COUNT, REQUEST_TIMEOUT } from './interfaces';

export const parseJson = (source: string) => {
  let parsedJson;
  try {
    parsedJson = JSON.parse(source);
  } catch (parseError) {
    throw new Error('Could not parse Maester object as it is not a JSON object');
  }
  return parsedJson;
};

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

export const getFreshStreamChecker = () => {
  let previousStream: Readable;
  return (stream: Readable) => {
    // defensive check
    if (previousStream && previousStream === stream) {
      throw new PotentiallyConsumedStreamError('The stream callback must always return a new stream');
    }
    previousStream = stream;
  };
};

/**
 * if values are higher or lower the limit - they'll be overwritten.
 * returns valid values for RetryOptions
 */
export const validateRetryOptions = ({
  retriesCount = RETRIES_COUNT.defaultValue, requestTimeout = REQUEST_TIMEOUT.defaultValue
}: RetryOptions): RetryOptions => ({
  retriesCount: (retriesCount > RETRIES_COUNT.maxValue || retriesCount < RETRIES_COUNT.minValue) ? RETRIES_COUNT.defaultValue : retriesCount,
  requestTimeout: (requestTimeout > RETRIES_COUNT.maxValue || requestTimeout < RETRIES_COUNT.minValue) ? RETRIES_COUNT.defaultValue : requestTimeout
});

// the same logic as in https://github.com/softonic/axios-retry, which we actively use, but with max backoff
export const exponentialDelay = (currentRetries: number) => {
  const maxBackoff = 10000;
  const delay = (2 ** currentRetries) * 100;
  const randomSum = delay * 0.2 * Math.random(); // 0-20% of the delay
  return Math.min(delay + randomSum, maxBackoff);
};
