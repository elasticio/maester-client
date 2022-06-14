import { Readable } from 'stream';
import { JWTPayload } from './interfaces';

export const sleep = async (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const isEmptyObject = (object: JWTPayload): boolean => !Object.keys(object).length;

export const streamFromObject = async (data: object): Promise<Readable> => {
  const dataString = JSON.stringify(data);
  const stream = new Readable();
  stream.push(dataString);
  stream.push(null);
  return stream;
};
