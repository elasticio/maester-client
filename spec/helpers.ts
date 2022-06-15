/* eslint-disable import/first */
process.env.REQUEST_MAX_RETRY = '3';
process.env.REQUEST_RETRY_DELAY = '0';
import { Readable, Duplex } from 'stream';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import getLogger from '@elastic.io/component-logger';
import sinon from 'sinon';

export const getContext = () => ({
  logger: getLogger(),
  emit: sinon.spy(),
});

const MESSAGE_CRYPTO_PASSWORD = 'testCryptoPassword';
const MESSAGE_CRYPTO_IV = 'iv=any16_symbols';
const ALGORITHM = 'aes-256-cbc';

export const encryptStream = (): Duplex => {
  const encodeKey = crypto.createHash('sha256').update(MESSAGE_CRYPTO_PASSWORD, 'utf8').digest();
  return crypto.createCipheriv(ALGORITHM, encodeKey, MESSAGE_CRYPTO_IV);
};

export const decryptStream = (): Duplex => {
  const decodeKey = crypto.createHash('sha256').update(MESSAGE_CRYPTO_PASSWORD, 'utf8').digest();
  return crypto.createDecipheriv(ALGORITHM, decodeKey, MESSAGE_CRYPTO_IV);
};

export const zip = (): Duplex => zlib.createGzip();

export const unzip = (): Duplex => zlib.createGunzip();

export const streamFromObject = (data: object): Readable => {
  const dataString = JSON.stringify(data);
  const stream = new Readable();
  stream.push(dataString);
  stream.push(null);
  return stream;
};
