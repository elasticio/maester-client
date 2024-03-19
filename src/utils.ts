import { Readable } from 'stream';
import { PotentiallyConsumedStreamError } from './errors';
import { uploadData, RetryOptions, RETRIES_COUNT, REQUEST_TIMEOUT } from './interfaces';

const ENV_RETRIES_COUNT = process.env.REQUEST_MAX_RETRY ? parseInt(process.env.REQUEST_MAX_RETRY, 10) : null;
const ENV_REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT ? parseInt(process.env.REQUEST_TIMEOUT, 10) : null;

export const parseJson = (source: string) => {
  let parsedJson;
  try {
    parsedJson = JSON.parse(source);
  } catch (parseError) {
    throw new Error('Could not parse Maester object as it is not a JSON object');
  }
  return parsedJson;
};

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
export const validateAndGetRetryOptions = ({
  retriesCount = ENV_RETRIES_COUNT || RETRIES_COUNT.defaultValue,
  requestTimeout = ENV_REQUEST_TIMEOUT || REQUEST_TIMEOUT.defaultValue
}: RetryOptions): RetryOptions => ({
  retriesCount: (retriesCount > RETRIES_COUNT.maxValue || retriesCount < RETRIES_COUNT.minValue) ? RETRIES_COUNT.defaultValue : retriesCount,
  requestTimeout: (requestTimeout > REQUEST_TIMEOUT.maxValue || requestTimeout < REQUEST_TIMEOUT.minValue) ? REQUEST_TIMEOUT.defaultValue : requestTimeout
});

export const exponentialSleep = async (currentRetries: number) => sleep(exponentialDelay(currentRetries));

const sleep = async (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const exponentialDelay = (currentRetries: number) => {
  const maxBackoff = 15000;
  const delay = (2 ** currentRetries) * 100;
  const randomSum = delay * 0.2 * Math.random(); // 0-20% of the delay
  return Math.min(delay + randomSum, maxBackoff);
};
