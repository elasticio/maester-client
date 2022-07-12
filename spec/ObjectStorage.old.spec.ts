/* eslint-disable no-unused-expressions */
import nock from 'nock';
import sinon from 'sinon';
import getStream from 'get-stream';
import { expect } from 'chai';
import { verify, sign } from 'jsonwebtoken';
import { ServerTransportError, JwtNotProvidedError } from '../src/errors';
import logging from '../src/logger';
import { ObjectStorage } from '../src';
import {
  encryptStream, decryptStream, zip, unzip, streamFromObject
} from './helpers';

describe('Object Storage', () => {
  const config = {
    uri: 'https://ma.es.ter',
    jwtSecret: 'jwt',
  };
  const objectStorage = new ObjectStorage(config);
  const postData = { test: 'test' };
  const responseData = {
    contentLength: 'meta.contentLength',
    contentType: 'meta.contentType',
    createdAt: 'meta.createdAt',
    md5: 'meta.md5Hash',
    objectId: 'obj.id',
    metadata: 'meta.userMetadata',
  };

  afterEach(sinon.restore);

  function authHeaderMatch(jwtPayload?: { [index: string]: string }) {
    return (val: string) => {
      const decoded = verify(val.split(' ')[1], config.jwtSecret);
      if (jwtPayload) {
        expect(decoded).to.deep.include(jwtPayload);
      }
      return !!decoded;
    };
  }

  describe('basic', () => {
    describe('data mode', () => {
      it('should fail after 3 retries', async () => {
        const log = sinon.stub(logging, 'warn');
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .get('/objects/1')
          .replyWithError({ code: 'ETIMEDOUT' })
          .get('/objects/1')
          .reply(500)
          .get('/objects/1')
          .replyWithError({ code: 'ENOTFOUND' });

        let err;
        try {
          await objectStorage.getOne('1', { jwtPayloadOrToken: {} });
        } catch (e) {
          err = e;
        }

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(err).to.be.instanceOf(ServerTransportError);
        expect(log.getCall(1).args[1].toString()).to.include('Error during object request');
        expect(log.callCount).to.be.equal(3);
      });
      it('should retry get request 3 times on errors', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .get('/objects/1')
          .reply(500)
          .get('/objects/1')
          .replyWithError({ code: 'ECONNRESET' })
          .get('/objects/1')
          .reply(200, streamFromObject(responseData));

        const out = await objectStorage.getOne('1', { jwtPayloadOrToken: {} });

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(out).to.be.deep.equal(responseData);
      });
      it('should retry get as string request 3 times on errors', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .get('/objects/1')
          .reply(500)
          .get('/objects/1')
          .replyWithError({ code: 'ECONNRESET' })
          .get('/objects/1')
          .reply(200, streamFromObject(responseData));

        const out = await objectStorage.getOne('1', { jwtPayloadOrToken: {} });

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(out).to.be.deep.equal(responseData);
      });
      it('should retry post request 3 times on errors', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .post('/objects')
          .replyWithError({ code: 'ECONNREFUSED' })
          .post('/objects')
          .reply(500)
          .post('/objects')
          .reply(200, responseData);

        await objectStorage.add(postData, { jwtPayloadOrToken: {} });

        expect(objectStorageCalls.isDone()).to.be.true;
      });
      it('should retry put request 3 times on errors', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .put('/objects/1')
          .replyWithError({ code: 'ECONNREFUSED' })
          .put('/objects/1')
          .reply(500)
          .put('/objects/1')
          .reply(200, responseData);

        const response = await objectStorage.update('1', postData, { jwtPayloadOrToken: {} });

        expect(response).to.deep.equal(responseData);
        expect(objectStorageCalls.isDone()).to.be.true;
      });
      it('should accept jwt token on add', async () => {
        const jwtPayload = { tenantId: '12', contractId: '1' };
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch(jwtPayload))
          .post('/objects')
          .reply(200);

        const objectId = await objectStorage.add(postData, {
          jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
        });

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(objectId).to.match(/^[0-9a-z-]+$/);
      });
      it('should accept jwt token on get', async () => {
        const jwtPayload = { tenantId: '12', contractId: '1' };
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch(jwtPayload))
          .get('/objects/1')
          .reply(200, streamFromObject(responseData));

        const out = await objectStorage.getOne('1', {
          jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
        });

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(out).to.be.deep.equal(responseData);
      });
      it('should accept jwt token on delete', async () => {
        const jwtPayload = { tenantId: '12', contractId: '1' };
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch(jwtPayload))
          .delete('/objects/1')
          .reply(204);

        await objectStorage.deleteOne('1', {
          jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
        });

        expect(objectStorageCalls.isDone()).to.be.true;
      });
      it('should accept jwt token on put', async () => {
        const jwtPayload = { tenantId: '12', contractId: '1' };
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch(jwtPayload))
          .put('/objects/1')
          .reply(200, responseData);

        const response = await objectStorage.update('1', postData, {
          jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
        });

        expect(response).to.deep.equal(responseData);
        expect(objectStorageCalls.isDone()).to.be.true;
      });
      it('should throw exception if neither jwt secret, nor jwt token provided', async () => {
        // @ts-ignore
        const objectStorage2 = new ObjectStorage({ uri: config.uri });

        let err;
        try {
          await objectStorage2.getOne('1', { jwtPayloadOrToken: {} });
        } catch (e) {
          err = e;
        }

        expect(err).to.be.instanceOf(JwtNotProvidedError);
      });
    });
    describe('stream mode', () => {
      it('should fail after 3 get retries', async () => {
        const log = sinon.stub(logging, 'warn');
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .get('/objects/1')
          .replyWithError({ code: 'ETIMEDOUT' })
          .get('/objects/1')
          .reply(500)
          .get('/objects/1')
          .replyWithError({ code: 'ENOTFOUND' });

        let err;
        try {
          await objectStorage.getOne('1', { jwtPayloadOrToken: {} });
        } catch (e) {
          err = e;
        }

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(err).to.be.instanceOf(ServerTransportError);
        expect(log.getCall(1).args[1].toString()).to.include('Error during object request');
        expect(log.callCount).to.be.equal(3);
      });
      it('should retry get request on errors', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .get('/objects/1')
          .reply(500)
          .get('/objects/1')
          .reply(200, streamFromObject(responseData));

        const response = await objectStorage.getOne('1', { jwtPayloadOrToken: {}, responseType: 'stream' });

        const out = JSON.parse(await getStream(response));
        expect(objectStorageCalls.isDone()).to.be.true;
        expect(out).to.be.deep.equal(responseData);
      });
      it('should throw an error on put request connection error', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .post('/objects')
          .replyWithError({ code: 'ECONNREFUSED' })
          .post('/objects')
          .replyWithError({ code: 'ECONNREFUSED' })
          .post('/objects')
          .replyWithError({ code: 'ECONNREFUSED' });

        let err;
        try {
          await objectStorage.add(streamFromObject(postData), { jwtPayloadOrToken: {} });
        } catch (e) {
          err = e;
        }

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(err).to.be.instanceOf(ServerTransportError);
      });
      it('should throw an error on put request http error', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .post('/objects')
          .reply(500)
          .post('/objects')
          .reply(500)
          .post('/objects')
          .reply(500);

        let err;
        try {
          await objectStorage.add(streamFromObject(postData), { jwtPayloadOrToken: {} });
        } catch (e) {
          err = e;
        }
        expect(objectStorageCalls.isDone()).to.be.true;
        expect(err).to.be.instanceOf(ServerTransportError);
      });
      it('should retry put request 3 times on errors', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .put('/objects/1')
          .replyWithError({ code: 'ECONNREFUSED' })
          .put('/objects/1')
          .reply(500)
          .put('/objects/1')
          .reply(200, responseData);

        const response = await objectStorage.update('1', streamFromObject(postData), { jwtPayloadOrToken: {} });

        expect(response).to.deep.equal(responseData);
        expect(objectStorageCalls.isDone()).to.be.true;
      });
      it('should put successfully', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .post('/objects')
          .reply(200);

        const objectId = await objectStorage.add(streamFromObject(postData), { jwtPayloadOrToken: {} });

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(objectId).to.match(/^[0-9a-z-]+$/);
      });
      it('should use valid jwt token', async () => {
        const jwtPayload = { tenantId: '12', contractId: '1' };
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch(jwtPayload))
          .post('/objects')
          .reply(200);

        const objectId = await objectStorage.add(streamFromObject(postData), {
          jwtPayloadOrToken: jwtPayload
        });

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(objectId).to.match(/^[0-9a-z-]+$/);
      });
      it('should accept jwt token on put', async () => {
        const jwtPayload = { tenantId: '12', contractId: '1' };
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch(jwtPayload))
          .put('/objects/1')
          .reply(200, responseData);

        const response = await objectStorage.update('1', streamFromObject(postData), {
          jwtPayloadOrToken: jwtPayload
        });

        expect(response).to.deep.equal(responseData);
        expect(objectStorageCalls.isDone()).to.be.true;
      });
    });
    describe('middlewares + zip/unzip and encrypt/decrypt', () => {
      describe('data mode', () => {
        it('should fail after 3 retries', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const log = sinon.stub(logging, 'warn');
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch())
            .get('/objects/1')
            .replyWithError({ code: 'ETIMEDOUT' })
            .get('/objects/1')
            .reply(500)
            .get('/objects/1')
            .replyWithError({ code: 'ENOTFOUND' });

          let err;
          try {
            await objectStorageWithMiddlewares.getOne('1', { jwtPayloadOrToken: {} });
          } catch (e) {
            err = e;
          }

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(err).to.be.instanceOf(ServerTransportError);
          expect(log.getCall(1).args[1].toString()).to.include('Error during object request');
          expect(log.callCount).to.be.equal(3);
        });
        it('should retry get request 3 times on errors', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch())
            .get('/objects/1')
            .reply(500)
            .get('/objects/1')
            .replyWithError({ code: 'ECONNRESET' })
            .get('/objects/1')
            .reply(200, () => {
              const stream = streamFromObject(responseData);
              return stream.pipe(encryptStream()).pipe(zip());
            });

          const out = await objectStorageWithMiddlewares.getOne('1', { jwtPayloadOrToken: {} });

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(out).to.be.deep.equal(responseData);
        });
        it('should retry post request 3 times on errors', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch())
            .post('/objects')
            .replyWithError({ code: 'ECONNREFUSED' })
            .post('/objects')
            .reply(500)
            .post('/objects')
            .reply(200, responseData);

          await objectStorageWithMiddlewares.add(postData, { jwtPayloadOrToken: {} });

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        });
        it('should retry put request 3 times on errors', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch())
            .put('/objects/1')
            .replyWithError({ code: 'ECONNREFUSED' })
            .put('/objects/1')
            .reply(500)
            .put('/objects/1')
            .reply(200, responseData);

          const response = await objectStorageWithMiddlewares.update('1', postData, { jwtPayloadOrToken: {} });

          expect(response).to.deep.equal(responseData);
          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        });
        it('should accept jwt token on add', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const jwtPayload = { tenantId: '12', contractId: '1' };
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch(jwtPayload))
            .post('/objects')
            .reply(200);

          const objectId = await objectStorageWithMiddlewares.add(postData, {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(objectId).to.match(/^[0-9a-z-]+$/);
        });
        it('should accept jwt token on put', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const jwtPayload = { tenantId: '12', contractId: '1' };
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch(jwtPayload))
            .put('/objects/1')
            .reply(200, responseData);

          const response = await objectStorageWithMiddlewares.update('1', postData, {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });

          expect(response).to.deep.equal(responseData);
          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        });
        it('should accept jwt token on get', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);

          const jwtPayload = { tenantId: '12', contractId: '1' };
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch(jwtPayload))
            .get('/objects/1')
            .reply(200, () => {
              const stream = streamFromObject(responseData);
              return stream.pipe(encryptStream()).pipe(zip());
            });

          const out = await objectStorageWithMiddlewares.getOne('1', {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(out).to.be.deep.equal(responseData);
        });
        it('should add 2 objects successfully', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const jwtPayload = { tenantId: '12', contractId: '1' };
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch(jwtPayload))
            .post('/objects')
            .reply(200, { objectId: '1' })
            .post('/objects')
            .reply(200, { objectId: '2' });

          const objectIdFirst = await objectStorageWithMiddlewares.add(postData, {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });
          const objectIdSecond = await objectStorageWithMiddlewares.add(postData, {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });
          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(objectIdFirst).to.be.equal('1');
          expect(objectIdSecond).to.be.equal('2');
        });
        it('should put 2 objects successfully', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const jwtPayload = { tenantId: '12', contractId: '1' };
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch(jwtPayload))
            .put('/objects/1')
            .reply(200, responseData)
            .put('/objects/2')
            .reply(200, responseData);

          const responseFirst = await objectStorageWithMiddlewares.update('1', postData, {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });
          const responseSecond = await objectStorageWithMiddlewares.update('2', postData, {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(responseFirst).to.deep.equal(responseData);
          expect(responseSecond).to.deep.equal(responseData);
        });
        it('should get 2 objects successfully', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);

          const jwtPayload = { tenantId: '12', contractId: '1' };
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch(jwtPayload))
            .get('/objects/1')
            .reply(200, () => {
              const stream = streamFromObject(responseData);
              return stream.pipe(encryptStream()).pipe(zip());
            })
            .get('/objects/2')
            .reply(200, () => {
              const stream = streamFromObject(responseData);
              return stream.pipe(encryptStream()).pipe(zip());
            });

          const outFirst = await objectStorageWithMiddlewares.getOne('1', {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });
          const outSecond = await objectStorageWithMiddlewares.getOne('2', {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(outFirst).to.be.deep.equal(responseData);
          expect(outSecond).to.be.deep.equal(responseData);
        });
        it('should throw exception if neither jwt secret, nor jwt token provided', async () => {
          // @ts-ignore
          const objectStorageWithMiddlewares = new ObjectStorage({ uri: config.uri });

          let err;
          try {
            await objectStorageWithMiddlewares.getOne('1', { jwtPayloadOrToken: {} });
          } catch (e) {
            err = e;
          }

          expect(err).to.be.instanceOf(JwtNotProvidedError);
        });
      });
      describe('stream mode', () => {
        it('should fail after 3 get retries', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const log = sinon.stub(logging, 'warn');
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch())
            .get('/objects/1')
            .replyWithError({ code: 'ETIMEDOUT' })
            .get('/objects/1')
            .reply(500)
            .get('/objects/1')
            .replyWithError({ code: 'ENOTFOUND' });

          let err;
          try {
            await objectStorageWithMiddlewares.getOne('1', { jwtPayloadOrToken: {} });
          } catch (e) {
            err = e;
          }

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(err).to.be.instanceOf(ServerTransportError);
          expect(log.getCall(1).args[1].toString()).to.include('Error during object request');
          expect(log.callCount).to.be.equal(3);
        });
        it('should retry get request on errors', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch())
            .get('/objects/1')
            .reply(500)
            .get('/objects/1')
            .reply(200, () => {
              const stream = streamFromObject(responseData);
              return stream.pipe(encryptStream()).pipe(zip());
            });

          const response = await objectStorageWithMiddlewares.getOne('1', { jwtPayloadOrToken: {} });

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(response).to.be.deep.equal(responseData);
        });
        it('should throw an error on put request connection error', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch())
            .post('/objects')
            .replyWithError({ code: 'ECONNREFUSED' })
            .post('/objects')
            .replyWithError({ code: 'ECONNREFUSED' })
            .post('/objects')
            .replyWithError({ code: 'ECONNREFUSED' });

          let err;
          try {
            await objectStorageWithMiddlewares.add(streamFromObject(postData), { jwtPayloadOrToken: {} });
          } catch (e) {
            err = e;
          }

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(err).to.be.instanceOf(ServerTransportError);
        });
        it('should throw an error on post request http error and no retries', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch())
            .post('/objects')
            .reply(500)
            .post('/objects')
            .reply(500)
            .post('/objects')
            .reply(500);

          let err;
          try {
            await objectStorageWithMiddlewares.add(streamFromObject(postData), { jwtPayloadOrToken: {} });
          } catch (e) {
            err = e;
          }
          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(err).to.be.instanceOf(ServerTransportError);
        });
        it('should retry put request 3 times on errors', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch())
            .put('/objects/1')
            .replyWithError({ code: 'ECONNREFUSED' })
            .put('/objects/1')
            .reply(500)
            .put('/objects/1')
            .reply(200, responseData);

          const response = await objectStorageWithMiddlewares
            .update('1', streamFromObject(postData), { jwtPayloadOrToken: {} });

          expect(response).to.deep.equal(responseData);
          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        });
        it('should post successfully', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch())
            .post('/objects')
            .reply(200, { objectId: '1' });

          const objectId = await objectStorageWithMiddlewares.add(streamFromObject(postData), { jwtPayloadOrToken: {} });

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(objectId).to.be.equal('1');
        });
        it('should add 2 objects successfully', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const jwtPayload = { tenantId: '12', contractId: '1' };
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch(jwtPayload))
            .post('/objects')
            .reply(200, { objectId: '1' })
            .post('/objects')
            .reply(200, { objectId: '2' });

          const objectIdFirst = await objectStorageWithMiddlewares.add(streamFromObject(postData), {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });
          const objectIdSecond = await objectStorageWithMiddlewares.add(streamFromObject(postData), {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });
          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(objectIdFirst).to.be.equal('1');
          expect(objectIdSecond).to.be.equal('2');
        });
        it('should put 2 objects successfully', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const jwtPayload = { tenantId: '12', contractId: '1' };
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch(jwtPayload))
            .put('/objects/1')
            .reply(200, responseData)
            .put('/objects/2')
            .reply(200, responseData);

          const responseFirst = await objectStorageWithMiddlewares.update('1', streamFromObject(postData), {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });
          const responseSecond = await objectStorageWithMiddlewares.update('2', streamFromObject(postData), {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
          });

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(responseFirst).to.deep.equal(responseData);
          expect(responseSecond).to.deep.equal(responseData);
        });
        it('should get 2 objects successfully', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);

          const jwtPayload = { tenantId: '12', contractId: '1' };
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch(jwtPayload))
            .get('/objects/1')
            .reply(200, () => {
              const stream = streamFromObject(responseData);
              return stream.pipe(encryptStream()).pipe(zip());
            })
            .get('/objects/2')
            .reply(200, () => {
              const stream = streamFromObject(responseData);
              return stream.pipe(encryptStream()).pipe(zip());
            });

          const outStreamFirst = await objectStorageWithMiddlewares.getOne('1', {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret),
            responseType: 'stream'
          });
          const outFirst = JSON.parse(await getStream(outStreamFirst));
          const outStreamSecond = await objectStorageWithMiddlewares.getOne('2', {
            jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret),
            responseType: 'stream'
          });
          const outSecond = JSON.parse(await getStream(outStreamSecond));
          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(outFirst).to.be.deep.equal(responseData);
          expect(outSecond).to.be.deep.equal(responseData);
        });
        it('should use valid jwt token', async () => {
          const objectStorageWithMiddlewares = new ObjectStorage(config);
          objectStorageWithMiddlewares.use(encryptStream, decryptStream);
          objectStorageWithMiddlewares.use(zip, unzip);
          const jwtPayload = { tenantId: '12', contractId: '1' };
          const objectStorageWithMiddlewaresCalls = nock(config.uri)
            .matchHeader('authorization', authHeaderMatch(jwtPayload))
            .post('/objects')
            .reply(200);

          const objectId = await objectStorageWithMiddlewares.add(streamFromObject(postData), {
            jwtPayloadOrToken: jwtPayload
          });

          expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
          expect(objectId).to.match(/^[0-9a-z-]+$/);
        });
      });
    });
  });
});
