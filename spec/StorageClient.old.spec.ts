/* eslint-disable no-unused-expressions */
import nock from 'nock';
import sinon from 'sinon';
import { expect } from 'chai';
import getStream from 'get-stream';
import { verify, sign } from 'jsonwebtoken';
import { Readable } from 'stream';
import { StorageClient } from '../src/StorageClient';
import { ServerTransportError, JwtNotProvidedError } from '../src/errors';
import logging from '../src/logger';
import { streamFromObject } from './helpers';

describe('Storage Client', () => {
  const config = {
    uri: 'https://ma.es.ter',
    jwtSecret: 'jwt'
  };
  const storageClient = new StorageClient(config);

  const data = { test: 'test' };

  const responseData = {
    contentLength: 'meta.contentLength',
    contentType: 'meta.contentType',
    createdAt: 'meta.createdAt',
    md5: 'meta.md5Hash',
    objectId: 'obj.id',
    metadata: 'meta.userMetadata'
  };

  afterEach(() => {
    sinon.restore();
  });

  function authHeaderMatch(jwtPayload?: { [index: string]: string }) {
    return (val: string) => {
      const decoded = verify(val.split(' ')[1], config.jwtSecret);
      if (jwtPayload) {
        expect(decoded).to.deep.include(jwtPayload);
      }
      return !!decoded;
    };
  }

  describe('get', () => {
    it('should throw exception if neither jwt secret, nor jwt token provided', async () => {
      // @ts-ignore
      const storageClient2 = new StorageClient({ uri: config.uri });

      let err;
      try {
        await storageClient2.get('1', { jwtPayloadOrToken: {} });
      } catch (e) {
        err = e;
      }

      expect(err.toString()).to.include('JWT');
    });
    it('should fail after 3 retries', async () => {
      const log = sinon.stub(logging, 'warn');
      const storageClientCalls = nock(config.uri)
        .matchHeader('authorization', authHeaderMatch())
        .get('/objects/1')
        .replyWithError({ code: 'ETIMEDOUT' })
        .get('/objects/1')
        .reply(502)
        .get('/objects/1')
        .replyWithError({ code: 'ENOTFOUND' });

      let err;
      try {
        await storageClient.get('1', { jwtPayloadOrToken: {} });
      } catch (e) {
        err = e;
      }
      expect(storageClientCalls.isDone()).to.be.true;
      expect(err).to.be.instanceOf(ServerTransportError);
      expect(log.getCall(1).args[1].toString()).to.include('Error during object request');
      expect(log.callCount).to.be.equal(3);
    });
    it('should not retry because of config', async () => {
      const log = sinon.stub(logging, 'warn');
      const storageClientCalls = nock(config.uri)
        .matchHeader('authorization', authHeaderMatch())
        .get('/objects/1')
        .reply(500);

      let err;
      try {
        await storageClient.get('1', { jwtPayloadOrToken: {}, retryOptions: { retriesCount: 0 } });
      } catch (e) {
        err = e;
      }
      expect(storageClientCalls.isDone()).to.be.true;
      expect(err).to.be.instanceOf(ServerTransportError);
      expect(log.callCount).to.be.equal(0);
    });
    it('should not retry 4xx client error', async () => {
      const log = sinon.stub(logging, 'warn');
      const storageClientCalls = nock(config.uri)
        .matchHeader('authorization', authHeaderMatch())
        .get('/objects/1')
        .reply(404);

      await expect(storageClient.get('1', { jwtPayloadOrToken: {} })).to.be.rejectedWith('Request failed with status code 404');

      expect(storageClientCalls.isDone()).to.be.true;
      expect(log.callCount).to.be.equal(0);
    });
    it('should accept jwt token on get', async () => {
      // @ts-ignore
      const storageClient2 = new StorageClient({ uri: config.uri });
      const jwtPayload = { tenantId: '12', contractId: '1' };
      const storageClientCalls = nock(config.uri)
        .matchHeader('authorization', authHeaderMatch(jwtPayload))
        .get('/objects/1')
        .reply(200, streamFromObject(data));

      const response = await storageClient2.get('1', {
        jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret)
      });
      expect(storageClientCalls.isDone()).to.be.true;
      expect(response.data).to.be.instanceOf(Readable);
      const resultData = JSON.parse(await getStream(response.data));
      expect(resultData).to.be.deep.equal(data);
    });
    it('should retry get request 3 times on errors', async () => {
      const storageClientCalls = nock(config.uri)
        .matchHeader('authorization', authHeaderMatch())
        .get('/objects/1')
        .reply(502)
        .get('/objects/1')
        .replyWithError({ code: 'ECONNRESET' })
        .get('/objects/1')
        .reply(200, streamFromObject(data));

      const response = await storageClient.get('1', { jwtPayloadOrToken: {} });

      expect(storageClientCalls.isDone()).to.be.true;
      expect(response.data).to.be.instanceOf(Readable);
      const resultData = JSON.parse(await getStream(response.data));
      expect(resultData).to.be.deep.equal(data);
    });
    describe('post', () => {
      it('should retry post request 3 times on errors', async () => {
        const storageClientCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .post('/objects')
          .replyWithError({ code: 'ECONNREFUSED' })
          .post('/objects')
          .reply(502)
          .post('/objects')
          .reply(200, responseData);

        const postStream = async () => streamFromObject(data);
        const response = await storageClient.post(postStream, { jwtPayloadOrToken: {} });
        expect(response.data).to.be.deep.equal(responseData);
        expect(storageClientCalls.isDone()).to.be.true;
      });
      it('should accept jwt token on add', async () => {
        // @ts-ignore
        const storageClient2 = new StorageClient({ uri: config.uri });

        const jwtPayload = { tenantId: '12', contractId: '1' };
        const storageClientCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch(jwtPayload))
          .post('/objects')
          .reply(200, responseData);

        const postStream = async () => streamFromObject(data);
        const response = await storageClient2.post(postStream, { jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret) });
        expect(storageClientCalls.isDone()).to.be.true;
        expect(response.data).to.be.deep.equal(responseData);
        expect(storageClientCalls.isDone()).to.be.true;
      });
    });

    describe('put', () => {
      it('should fail after 3 retries', async () => {
        const storageClientCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .put('/objects/1')
          .replyWithError({ code: 'ECONNREFUSED' })
          .put('/objects/1')
          .reply(502)
          .put('/objects/1')
          .replyWithError({ code: 'ENOTFOUND' });

        let err;
        try {
          const putStream = async () => streamFromObject(data);
          await storageClient.put('1', putStream, { jwtPayloadOrToken: {} });
        } catch (e) {
          err = e;
        }

        expect(err).to.be.instanceOf(ServerTransportError);
        expect(storageClientCalls.isDone()).to.be.true;
      });
      it('should throw exception if neither jwt secret, nor jwt token provided', async () => {
        // @ts-ignore
        const storageClient2 = new StorageClient({ uri: config.uri });

        let err;
        try {
          const putStream = async () => streamFromObject(data);
          await storageClient2.put('1', putStream, { jwtPayloadOrToken: {} });
        } catch (e) {
          err = e;
        }

        expect(err).to.be.instanceOf(JwtNotProvidedError);
      });
      it('should accept jwt token on add', async () => {
        // @ts-ignore
        const storageClient2 = new StorageClient({ uri: config.uri });

        const jwtPayload = { tenantId: '12', contractId: '1' };
        const storageClientCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch(jwtPayload))
          .put('/objects/1')
          .reply(200, responseData);

        const putStream = async () => streamFromObject(data);
        const response = await storageClient2.put('1', putStream, { jwtPayloadOrToken: sign(jwtPayload, config.jwtSecret) });
        expect(storageClientCalls.isDone()).to.be.true;
        expect(response.data).to.be.deep.equal(responseData);
        expect(storageClientCalls.isDone()).to.be.true;
      });
      it('should retry post request 3 times on errors', async () => {
        const storageClientCalls = nock(config.uri)
          .matchHeader('authorization', authHeaderMatch())
          .put('/objects/1')
          .replyWithError({ code: 'ECONNREFUSED' })
          .put('/objects/1')
          .reply(502)
          .put('/objects/1')
          .reply(200, responseData);

        const putStream = async () => streamFromObject(data);
        const response = await storageClient.put('1', putStream, { jwtPayloadOrToken: {} });
        expect(response.data).to.be.deep.equal(responseData);
        expect(storageClientCalls.isDone()).to.be.true;
      });
    });
  });
});
