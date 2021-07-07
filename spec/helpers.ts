import { Readable, Duplex } from "stream";
import * as crypto from "crypto";
import * as zlib from "zlib";

const MESSAGE_CRYPTO_PASSWORD = "testCryptoPassword";
const MESSAGE_CRYPTO_IV = "iv=any16_symbols";
const ALGORITHM = "aes-256-cbc";

export const streamResponse = (responseData: any) => () => {
  const stream = new Readable();
  stream.push(JSON.stringify(responseData));
  stream.push(null);
  return stream;
};

export const encryptStream = (): Duplex => {
  const encodeKey = crypto.createHash("sha256").update(MESSAGE_CRYPTO_PASSWORD, "utf8").digest();
  return crypto.createCipheriv(ALGORITHM, encodeKey, MESSAGE_CRYPTO_IV);
};

export const decryptStream = (): Duplex => {
  const decodeKey = crypto.createHash("sha256").update(MESSAGE_CRYPTO_PASSWORD, "utf8").digest();
  return crypto.createDecipheriv(ALGORITHM, decodeKey, MESSAGE_CRYPTO_IV);
};

export const zip = (): Duplex => zlib.createGzip();

export const unzip = (): Duplex => zlib.createGunzip();
