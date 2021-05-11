import nock from 'nock';
import sinonjs, { SinonSandbox } from 'sinon';
import { expect } from 'chai';
import logging from '../src/logger';
import { describe, beforeEach, afterEach, it } from 'mocha';
import StorageClient from '../src/storageClient';
import { Readable } from 'stream';
import { verify, sign } from 'jsonwebtoken';
import getStream from 'get-stream';
import { streamResponse } from './helpers';

describe('Storage Client', () => {
  const config = {
    uri: 'https://ma.es.ter',
    jwtSecret: 'jwt',
  };

  const data = { test: 'test' };

  const responseData = {
    contentLength: 'meta.contentLength',
    contentType: 'meta.contentType',
    createdAt: 'meta.createdAt',
    md5: 'meta.md5Hash',
    objectId: 'obj.id',
    metadata: 'meta.userMetadata',
  };

  let putStream: () => Readable;

  let sinon: SinonSandbox;
  beforeEach(async () => {
    sinon = sinonjs.createSandbox();

    putStream = () => {
      const stream = new Readable();
      stream.push(JSON.stringify(data));
      stream.push(null);
      return stream;
    };
  });
  afterEach(() => {
    sinon.restore();
  });

  function authHeaderMatch(jwtPayload?: { [index: string]: string }) {
    return (val: string) => {
      const decoded = verify(val.split(' ')[1], config.jwtSecret);
      if (jwtPayload) {
        expect(decoded).to.deep.include(jwtPayload);
      }
      return decoded;
    };
  }

  it('should fail after 3 retries', async () => {
    const log = sinon.stub(logging, 'warn');
    const storageClient = new StorageClient(config);

    const storageClientCalls = nock(config.uri)
      // @ts-ignore: Nock .d.ts are outdated.
      .matchHeader('authorization', authHeaderMatch())
      .get('/objects/1')
      .replyWithError({ code: 'ETIMEDOUT' })
      .get('/objects/1')
      .reply(404)
      .get('/objects/1')
      .replyWithError({ code: 'ENOTFOUND' });

    let err;
    try {
      await storageClient.readStream('1', {});
    } catch (e) {
      err = e;
    }
    expect(storageClientCalls.isDone()).to.be.true;
    expect(err.code).to.be.equal('ENOTFOUND');
    expect(log.getCall(1).args[1].toString()).to.include('404');
    expect(log.callCount).to.be.equal(2);
  });

  it('should retry get request 3 times on errors', async () => {
    const storageClient = new StorageClient(config);

    const storageClientCalls = nock(config.uri)
      // @ts-ignore: Nock .d.ts are outdated.
      .matchHeader('authorization', authHeaderMatch())
      .get('/objects/1')
      .reply(500)
      .get('/objects/1')
      .replyWithError({ code: 'ECONNRESET' })
      .get('/objects/1')
      .reply(200, streamResponse(data));

    const response = await storageClient.readStream('1', {});

    expect(storageClientCalls.isDone()).to.be.true;
    expect(response.data).to.be.instanceOf(Readable);
    const resultData = JSON.parse(await getStream(response.data));
    expect(resultData).to.be.deep.equal(data);
  });

  it('should retry post request 3 times on errors', async () => {
    const storageClient = new StorageClient(config);

    const storageClientCalls = nock(config.uri)
      // @ts-ignore: Nock .d.ts are outdated.
      .matchHeader('authorization', authHeaderMatch())
      .post('/objects')
      .replyWithError({ code: 'ECONNREFUSED' })
      .post('/objects')
      .reply(400)
      .post('/objects')
      .reply(200, responseData);

    const response = await storageClient.writeStream(putStream, {});
    expect(response.data).to.be.deep.equal(responseData);
    expect(storageClientCalls.isDone()).to.be.true;
  });

  it('should accept jwt token on add', async () => {
    const storageClient = new StorageClient({ uri: config.uri });

    const jwtPayload = { tenantId: '12', contractId: '1' };
    const storageClientCalls = nock(config.uri)
      // @ts-ignore: Nock .d.ts are outdated.
      .matchHeader('authorization', authHeaderMatch(jwtPayload))
      .post('/objects')
      .reply(200, responseData);

    const response = await storageClient.writeStream(putStream, sign(jwtPayload, config.jwtSecret));
    expect(storageClientCalls.isDone()).to.be.true;
    expect(response.data).to.be.deep.equal(responseData);
    expect(storageClientCalls.isDone()).to.be.true;
  });

  it('should accept jwt token on get', async () => {
    const storageClient = new StorageClient({ uri: config.uri });

    const jwtPayload = { tenantId: '12', contractId: '1' };
    const storageClientCalls = nock(config.uri)
      // @ts-ignore: Nock .d.ts are outdated.
      .matchHeader('authorization', authHeaderMatch(jwtPayload))
      .get('/objects/1')
      .reply(200, streamResponse(data));

    const response = await storageClient.readStream('1', sign(jwtPayload, config.jwtSecret));
    expect(storageClientCalls.isDone()).to.be.true;
    expect(response.data).to.be.instanceOf(Readable);
    const resultData = JSON.parse(await getStream(response.data));
    expect(resultData).to.be.deep.equal(data);
  });

  it('should throw exception if neither jwt secret, nor jwt token provided', async () => {
    const storageClient = new StorageClient({ uri: config.uri });

    let err;
    try {
      await storageClient.readStream('1', {});
    } catch (e) {
      err = e;
    }

    expect(err.toString()).to.include('JWT');
  });
});
