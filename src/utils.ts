import { JWTPayload } from './interfaces';

export const sleep = async (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const isEmptyObject = (object: JWTPayload): boolean => !Object.keys(object).length;
