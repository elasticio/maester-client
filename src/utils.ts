import { Readable } from 'stream';
import { JWTPayload, uploadData } from './interfaces';

export const sleep = async (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const isEmptyObject = (object: JWTPayload): boolean => !Object.keys(object).length;

// 'undefined' throws error, but 'null' is ok (as an option - convert 'undefined' to 'null')
export const streamFromData = async (data: uploadData): Promise<Readable> => {
  const dataString = JSON.stringify(data);
  const stream = new Readable();
  stream.push(dataString);
  stream.push(null);
  return stream;
};
