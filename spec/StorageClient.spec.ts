/* eslint-disable no-unused-expressions */
import nock from 'nock';
import { expect } from 'chai';
import getStream from 'get-stream';
import { StorageClient } from '../src/StorageClient';
import { streamFromObject } from './helpers';
import { RETRIES_COUNT } from '../src/interfaces';

describe('Storage Client', () => {
  const config = {
    uri: 'https://ma.es.ter',
    jwtSecret: 'jwt',
  };
  const storageClient = new StorageClient(config);
  const data = { test: 'test' };
  const responseData = {
    contentLength: 'meta.contentLength',
    contentType: 'meta.contentType',
    createdAt: 'meta.createdAt',
    md5: 'meta.md5Hash',
    objectId: 'obj.id',
    metadata: 'meta.userMetadata',
  };
  it(`should fail after ${RETRIES_COUNT.defaultValue} retries`, async () => {
    const storageClientCalls = nock(config.uri)
      .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
      .get('/objects/1')
      .times(3)
      .reply(520);

    await expect(storageClient.get('1', {})).to.be.rejectedWith('Server error during request');
    expect(storageClientCalls.isDone()).to.be.true;
  });
  it('should retry get request 3 times on errors', async () => {
    const storageClientCalls = nock(config.uri)
      .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
      .get('/objects/1')
      .reply(500)
      .get('/objects/1')
      .replyWithError({ code: 'ECONNRESET' })
      .get('/objects/1')
      .reply(200, streamFromObject(data));

    const { data: stream } = await storageClient.get('1', {});
    const response = await getStream(stream);
    expect(JSON.parse(response)).to.be.deep.equal(data);
    expect(storageClientCalls.isDone()).to.be.true;
  });
  it('should retry post request 3 times on errors', async () => {
    const storageClientCalls = nock(config.uri)
      .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
      .post('/objects')
      .replyWithError({ code: 'ECONNREFUSED' })
      .post('/objects')
      .reply(505)
      .post('/objects')
      .reply(200, responseData);

    const response = await storageClient.post(streamFromObject.bind({}, data));
    expect(response.data).to.be.deep.equal(responseData);
    expect(storageClientCalls.isDone()).to.be.true;
  });
});
