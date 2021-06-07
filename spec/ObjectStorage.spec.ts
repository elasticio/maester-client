/* eslint-disable no-unused-expressions */
import nock from 'nock';
import sinonjs, { SinonSandbox } from 'sinon';
import { expect } from 'chai';
import {
  describe, beforeEach, afterEach, it,
} from 'mocha';
import ObjectStorage from '../src/ObjectStorage';
import logging from '../src/logger';
import {
  streamResponse, encryptStream, decryptStream, zip, unzip,
} from './helpers';

describe('Object Storage', () => {
  const config = {
    uri: 'https://ma.es.ter',
    jwtSecret: 'jwt',
  };

  const postData = { test: 'test' };

  const responseData = {
    contentLength: 'meta.contentLength',
    contentType: 'meta.contentType',
    createdAt: 'meta.createdAt',
    md5: 'meta.md5Hash',
    objectId: 'obj.id',
    metadata: 'meta.userMetadata',
  };

  let sinon: SinonSandbox;
  beforeEach(async () => {
    sinon = sinonjs.createSandbox();
  });
  afterEach(() => {
    sinon.restore();
  });

  describe('basic', () => {
    describe('data mode', () => {
      it('should getAllByParams', async () => {
        const objectStorage = new ObjectStorage({ uri: config.uri, jwtSecret: config.jwtSecret });

        const objectStorageCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects?foo=bar')
          .reply(200, {});

        await objectStorage.getAllByParams({ foo: 'bar' });

        expect(objectStorageCalls.isDone()).to.be.true;
      });
    });

    describe('stream mode', () => {
      it('should fail after 3 get retries', async () => {
        const log = sinon.stub(logging, 'warn');
        const objectStorage = new ObjectStorage(config);

        const objectStorageCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects/1')
          .replyWithError({ code: 'ETIMEDOUT' })
          .get('/objects/1')
          .reply(404)
          .get('/objects/1')
          .replyWithError({ code: 'ENOTFOUND' });

        let err;
        try {
          await objectStorage.getById('1');
        } catch (e) {
          err = e;
        }

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(err.code).to.be.equal('ENOTFOUND');
        expect(log.getCall(1).args[1].toString()).to.include('404');
        expect(log.callCount).to.be.equal(2);
      });

      // TODO enable test
      xit('should retry get request on errors', async () => {
        const objectStorage = new ObjectStorage(config);

        const objectStorageCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects/1')
          .reply(500)
          .get('/objects/1')
          .reply(200, streamResponse(responseData));

        const response = await objectStorage.getById('1');

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(response).to.be.deep.equal(responseData);
      });

      it('should throw an error on put request connection error', async () => {
        const objectStorage = new ObjectStorage(config);

        const objectStorageCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .replyWithError({ code: 'ECONNREFUSED' })
          .post('/objects')
          .replyWithError({ code: 'ECONNREFUSED' })
          .post('/objects')
          .replyWithError({ code: 'ECONNREFUSED' });

        let err;
        try {
          await objectStorage.addOne(postData, {});
        } catch (e) {
          err = e;
        }

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(err.code).to.be.equal('ECONNREFUSED');
      });

      it('should throw an error on put request http error', async () => {
        const objectStorage = new ObjectStorage(config);

        const objectStorageCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .reply(409)
          .post('/objects')
          .reply(409)
          .post('/objects')
          .reply(409);

        let err;
        try {
          await objectStorage.addOne(postData, {});
        } catch (e) {
          err = e;
        }
        expect(objectStorageCalls.isDone()).to.be.true;
        expect(err.toString()).to.include('409');
      });

      it('should put successfully', async () => {
        const objectStorage = new ObjectStorage(config);

        const objectStorageCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .reply(200);

        const objectId = await objectStorage.addOne(postData, {});

        expect(objectStorageCalls.isDone()).to.be.true;
        expect(objectId).to.match(/^[0-9a-z-]+$/);
      });
    });
  });

  describe('middlewares + zip/unzip and encrypt/decrypt', () => {
    describe('stream mode', () => {
      it('should fail after 3 get retries', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);
        const log = sinon.stub(logging, 'warn');
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects/1')
          .replyWithError({ code: 'ETIMEDOUT' })
          .get('/objects/1')
          .reply(404)
          .get('/objects/1')
          .replyWithError({ code: 'ENOTFOUND' });

        let err;
        try {
          await objectStorageWithMiddlewares.getById('1');
        } catch (e) {
          err = e;
        }

        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        expect(err.code).to.be.equal('ENOTFOUND');
        expect(log.getCall(1).args[1].toString()).to.include('404');
        expect(log.callCount).to.be.equal(2);
      });

      // TODO enable test
      xit('should retry get request on errors', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects/1')
          .reply(500)
          .get('/objects/1')
          .reply(200, () => {
            const stream = streamResponse(responseData)();
            return stream.pipe(encryptStream()).pipe(zip());
          });

        const response = await objectStorageWithMiddlewares.getById('1');

        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        expect(response).to.be.deep.equal(responseData);
      });

      it('should throw an error on put request connection error', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .replyWithError({ code: 'ECONNREFUSED' })
          .post('/objects')
          .replyWithError({ code: 'ECONNREFUSED' })
          .post('/objects')
          .replyWithError({ code: 'ECONNREFUSED' });

        let err;
        try {
          await objectStorageWithMiddlewares.addOne(postData, {});
        } catch (e) {
          err = e;
        }

        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        expect(err.code).to.be.equal('ECONNREFUSED');
      });

      it('should throw an error on put request http error', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .reply(409)
          .post('/objects')
          .reply(409)
          .post('/objects')
          .reply(409);

        let err;
        try {
          await objectStorageWithMiddlewares.addOne(postData, {});
        } catch (e) {
          err = e;
        }
        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        expect(err.toString()).to.include('409');
      });

      it('should post successfully', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .reply(200, { objectId: '1' });

        const objectId = await objectStorageWithMiddlewares.addOne(postData, {});

        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        expect(objectId).to.be.equal('1');
      });

      it('should add 2 objects successfully', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .reply(200, { objectId: '1' })
          .post('/objects')
          .reply(200, { objectId: '2' });

        const objectIdFirst = await objectStorageWithMiddlewares.addOne(postData, {});
        const objectIdSecond = await objectStorageWithMiddlewares.addOne(postData, {});
        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        expect(objectIdFirst).to.be.equal('1');
        expect(objectIdSecond).to.be.equal('2');
      });

      // TODO enable test
      xit('should get 2 objects successfully', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);

        const objectStorageWithMiddlewaresCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects/1')
          .reply(200, () => {
            const stream = streamResponse(responseData)();
            return stream.pipe(encryptStream()).pipe(zip());
          })
          .get('/objects/2')
          .reply(200, () => {
            const stream = streamResponse(responseData)();
            return stream.pipe(encryptStream()).pipe(zip());
          });

        const outStreamFirst = await objectStorageWithMiddlewares.getById('1');
        const outStreamSecond = await objectStorageWithMiddlewares.getById('2');
        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        expect(outStreamFirst).to.be.deep.equal(responseData);
        expect(outStreamSecond).to.be.deep.equal(responseData);
      });

      it('should use valid jwt token', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
        // @ts-ignore: Nock .d.ts are outdated.
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .reply(200);

        const objectId = await objectStorageWithMiddlewares.addOne(postData, {});

        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
        expect(objectId).to.match(/^[0-9a-z-]+$/);
      });
    });
  });
});
