/* eslint-disable no-unused-expressions */
import nock from 'nock';
import sinon from 'sinon';
import getStream from 'get-stream';
import { expect } from 'chai';
import { ObjectStorage, StorageClient } from '../src';
import {
  encryptStream, decryptStream, zip, unzip, streamFromObject
} from './helpers';

xdescribe('Object Storage', () => {
  const config = {
    uri: 'https://ma.es.ter',
    jwtSecret: 'jwt',
  };
  const objectStorage = new ObjectStorage(config);
  const postData = { test: 'test' };
  const createdObjWithQueryField = {
    contentType: 'application/json',
    createdAt: 1622811501107,
    objectId: '2bd48165-119f-489d-8842-8d07b2c7cc1b',
    metadata: {},
    queriableFields: {
      demosearchfield: 'qwerty',
    },
  };
  const responseData = {
    contentLength: 'meta.contentLength',
    contentType: 'meta.contentType',
    createdAt: 'meta.createdAt',
    md5: 'meta.md5Hash',
    objectId: 'obj.id',
    metadata: 'meta.userMetadata',
  };

  let finalReqCfg;
  afterEach(sinon.restore);

  describe('basic', () => {
    describe('data mode', () => {
      describe('should getAllByParams', () => {
        beforeEach(async () => {
          finalReqCfg = sinon.stub(StorageClient.prototype, <any>'requestRetry').callsFake(async () => (
            { data: streamFromObject([createdObjWithQueryField, createdObjWithQueryField]) }
          ));
        });
        it('should getAllByParams', async () => {
          const result = await objectStorage.getAllByParams({ foo: 'bar' });
          expect(JSON.parse(result)).to.deep.equal([createdObjWithQueryField, createdObjWithQueryField]);
          const { firstArg, lastArg } = finalReqCfg.getCall(0);
          expect(lastArg).to.be.deep.equal({});
          expect(firstArg.getFreshStream).to.be.equal(undefined);
          expect(firstArg.axiosReqConfig).to.deep.equal({
            method: 'get',
            url: '/objects',
            responseType: 'stream',
            params: { foo: 'bar' },
            headers: { Authorization: 'Bearer jwt' }
          });
        });
      });
      describe('should getById (stream)', () => {
        beforeEach(async () => {
          finalReqCfg = sinon.stub(StorageClient.prototype, <any>'requestRetry').callsFake(async () => ({ data: streamFromObject({ q: 'i`m a stream' }) }));
        });
        it('should getById (stream)', async () => {
          const result = await objectStorage.getOne('objectId', { responseType: 'stream' });
          const streamAsJSON = await getStream(result);
          expect(JSON.parse(streamAsJSON)).to.be.deep.equal({ q: 'i`m a stream' });
          const { firstArg, lastArg } = finalReqCfg.getCall(0);
          expect(lastArg).to.be.deep.equal({});
          expect(firstArg.getFreshStream).to.be.equal(undefined);
          expect(firstArg.axiosReqConfig).to.deep.equal({
            method: 'get',
            url: '/objects/objectId',
            responseType: 'stream',
            params: {},
            headers: { Authorization: 'Bearer jwt' }
          });
        });
      });
      describe('should getById (json)', () => {
        beforeEach(async () => {
          finalReqCfg = sinon.stub(StorageClient.prototype, <any>'requestRetry').callsFake(async () => ({ data: streamFromObject({ q: 'i`m a stream' }) }));
        });
        it('should getById (json)', async () => {
          const result = await objectStorage.getOne('objectId', { responseType: 'json' });
          expect(result).to.be.equal(JSON.stringify({ q: 'i`m a stream' }));
          const { firstArg, lastArg } = finalReqCfg.getCall(0);
          expect(lastArg).to.be.deep.equal({});
          expect(firstArg.getFreshStream).to.be.equal(undefined);
          expect(firstArg.axiosReqConfig).to.deep.equal({
            method: 'get',
            url: '/objects/objectId',
            responseType: 'stream',
            params: {},
            headers: { Authorization: 'Bearer jwt' }
          });
        });
      });
      describe('should getById (arraybuffer)', () => {
        beforeEach(async () => {
          finalReqCfg = sinon.stub(StorageClient.prototype, <any>'requestRetry').callsFake(async () => ({ data: streamFromObject({ q: 'i`m a stream' }) }));
        });
        it('should getById (arraybuffer)', async () => {
          const result = await objectStorage.getOne('objectId', { responseType: 'arraybuffer' });
          const encodedResult = Buffer.from(JSON.stringify({ q: 'i`m a stream' }), 'binary').toString('base64');
          expect(result.toString('base64')).to.be.equal(encodedResult);
          const { firstArg, lastArg } = finalReqCfg.getCall(0);
          expect(lastArg).to.be.deep.equal({});
          expect(firstArg.getFreshStream).to.be.equal(undefined);
          expect(firstArg.axiosReqConfig).to.deep.equal({
            method: 'get',
            url: '/objects/objectId',
            responseType: 'stream',
            params: {},
            headers: { Authorization: 'Bearer jwt' }
          });
        });
      });
    });
    describe('stream mode', () => {
      it('should fail after 3 get retries', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects/1')
          .times(3)
          .reply(500);

        await expect(objectStorage.getOne('1')).to.be.rejectedWith('Server error during request');
        expect(objectStorageCalls.isDone()).to.be.true;
      });

      it('should retry get request on errors', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects/1')
          .reply(500)
          .get('/objects/1')
          .reply(200, streamFromObject(responseData));

        const response = await objectStorage.getOne('1', { responseType: 'json' });
        expect(objectStorageCalls.isDone()).to.be.true;
        expect(response).to.be.deep.equal(JSON.stringify(responseData));
      });

      it('should throw an error on post request connection error', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .times(3)
          .replyWithError({ code: 'ECONNREFUSED' });

        await expect(objectStorage.add(postData, {})).to.be.rejectedWith('Server error during request');
        expect(objectStorageCalls.isDone()).to.be.true;
      });

      it('should throw an error immediately on post request http error', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .reply(409);

        await expect(objectStorage.add(postData, {})).to.be.rejectedWith('Request failed with status code 409');
        expect(objectStorageCalls.isDone()).to.be.true;
      });

      it('should post successfully', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .reply(200);

        const objectId = await objectStorage.add(postData, {});
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
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects/1')
          .times(3)
          .replyWithError({ code: 'ETIMEDOUT' });

        await expect(objectStorageWithMiddlewares.getOne('1')).to.be.rejectedWith('Server error during request');
        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
      });
      it('should retry get request on errors', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);
        const responseStream = streamFromObject(responseData).pipe(encryptStream()).pipe(zip());
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects/1')
          .reply(500)
          .get('/objects/1')
          .reply(200, responseStream);

        const stream = await objectStorageWithMiddlewares.getOne('1', { responseType: 'stream' });
        const result = await getStream(stream);
        expect(result).to.be.deep.equal(JSON.stringify(responseData));
        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
      });
      it('should throw an error on post request connection error', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .times(3)
          .replyWithError({ code: 'ECONNREFUSED' });

        await expect(objectStorageWithMiddlewares.add(postData, {})).to.be.rejectedWith('Server error during request');
        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
      });
      it('should throw an error on post request http error', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .reply(409);

        await expect(objectStorageWithMiddlewares.add(postData, {})).to.be.rejectedWith('Request failed with status code 409');
        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
      });
      it('should post successfully', async () => {
        const objectStorageWithMiddlewares = new ObjectStorage(config);
        objectStorageWithMiddlewares.use(encryptStream, decryptStream);
        objectStorageWithMiddlewares.use(zip, unzip);
        const objectStorageWithMiddlewaresCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .post('/objects')
          .reply(200, streamFromObject({ objectId: 'dfsf-2dasd3-dsf2l' }));

        const response = await objectStorageWithMiddlewares.add(postData, {});
        expect(response).to.be.equal('dfsf-2dasd3-dsf2l');
        expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
      });
    });
  });
  describe('configure ReqOptions', () => {
    describe('configure ReqOptions', () => {
      beforeEach(async () => {
        finalReqCfg = sinon.spy(StorageClient.prototype, <any>'requestRetry');
      });
      it('configure ReqOptions', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects/1')
          .times(5)
          .replyWithError({ code: 'ETIMEDOUT' });

        const retryOptions = { retriesCount: 5, requestTimeout: 1, retryDelay: 1 };
        await expect(objectStorage.getOne('1', { retryOptions })).to.be.rejectedWith('Server error during request');
        expect(objectStorageCalls.isDone()).to.be.true;
        const { lastArg } = finalReqCfg.getCall(0);
        expect(lastArg).to.be.deep.equal(retryOptions);
      });
      it('configure ReqOptions', async () => {
        const objectStorageCalls = nock(config.uri)
          .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
          .get('/objects/1')
          .times(4)
          .replyWithError({ code: 'ETIMEDOUT' })
          .get('/objects/1')
          .reply(200, streamFromObject({ objectId: '234-sdf' }));

        const retryOptions = { retriesCount: 5, requestTimeout: 1, retryDelay: 1 };
        const result = await objectStorage.getOne('1', { retryOptions });
        expect(JSON.parse(result)).to.be.deep.equal({ objectId: '234-sdf' });
        expect(objectStorageCalls.isDone()).to.be.true;
        const { lastArg } = finalReqCfg.getCall(0);
        expect(lastArg).to.be.deep.equal(retryOptions);
      });
    });
  });
});
