import chai, { expect } from 'chai';
import axios from 'axios';
import sinon from 'sinon';
import fs from 'fs';
import { creds } from './common';
import * as utils from '../src/utils';
import logging from '../src/logger';
import { ObjectStorage } from '../src';
import { ClientTransportError, ServerTransportError } from '../src/errors';

chai.use(require('chai-as-promised'));

describe('objectStorage', () => {
  const objectStorage = new ObjectStorage(creds);
  describe('add', () => {
    describe('as stream', () => {
      it('should add (image)', async () => {
        const getAttachAsStream = async () => (await axios.get('https://if0s.info/files/1.jpg', { responseType: 'stream' })).data;
        const objectId = await objectStorage.add(getAttachAsStream);
        expect(typeof objectId).to.be.equal('string');
      });
      it('should add (pdf)', async () => {
        const getAttachAsStream = async () => (
          await axios.get('http://environmentclearance.nic.in/writereaddata/FormB/Agenda/2201201642EWMJ8Bpdf18.pdf', { responseType: 'stream' })
        ).data;
        const objectId = await objectStorage.add(getAttachAsStream);
        expect(typeof objectId).to.be.equal('string');
      });
      it('should add (json file)', async () => {
        const getAttachAsStream = async () => (
          await axios.get('https://raw.githubusercontent.com/elasticio/jsonata-transform-component/master/package-lock.json', { responseType: 'stream' })
        ).data;
        const objectId = await objectStorage.add(getAttachAsStream);
        expect(typeof objectId).to.be.equal('string');
      });
      it('should add (json)', async () => {
        const getJSONAsStream = async () => utils.streamFromData({ a: 4 });
        const objectId = await objectStorage.add(getJSONAsStream);
        expect(typeof objectId).to.be.equal('string');
        const { data } = await objectStorage.getOne(objectId);
        expect(data).to.be.deep.equal({ data: { a: 4 }, headers: {} });
      });
    });
    describe('as any', () => {
      it('should add (JSON)', async () => {
        const objectId = await objectStorage.add({ a: 2 });
        expect(typeof objectId).to.be.equal('string');
        const { data } = await objectStorage.getOne(objectId);
        expect(data).to.be.deep.equal({ a: 2 });
        const objectHeaders = await objectStorage.getHeaders(objectId);
        expect(objectHeaders['content-type']).to.be.equal('application/json');
      });
      it('should add array', async () => {
        const dataArray = [1, '2', null, { d: 2, a: 1 }];
        const objectId = await objectStorage.add(dataArray);
        expect(typeof objectId).to.be.equal('string');
        const { data } = await objectStorage.getOne(objectId);
        expect(data).to.be.deep.equal(dataArray);
        const objectHeaders = await objectStorage.getHeaders(objectId);
        expect(objectHeaders['content-type']).to.be.equal('application/json');
      });
      it('should add string', async () => {
        const dataString = 'hurray';
        const objectId = await objectStorage.add(dataString);
        expect(typeof objectId).to.be.equal('string');
        const { data } = await objectStorage.getOne(objectId);
        expect(data).to.be.deep.equal(dataString);
        const objectHeaders = await objectStorage.getHeaders(objectId);
        expect(objectHeaders['content-type']).to.be.equal('application/json');
      });
      it('should add number', async () => {
        const dataNumber = 56;
        const objectId = await objectStorage.add(dataNumber);
        expect(typeof objectId).to.be.equal('string');
        const { data } = await objectStorage.getOne(objectId);
        expect(data).to.be.deep.equal(dataNumber);
        const objectHeaders = await objectStorage.getHeaders(objectId);
        expect(objectHeaders['content-type']).to.be.equal('application/json');
      });
      it('should add null', async () => {
        const objectId = await objectStorage.add(null);
        expect(typeof objectId).to.be.equal('string');
        const { data } = await objectStorage.getOne(objectId);
        expect(data).to.be.deep.equal(null);
        const objectHeaders = await objectStorage.getHeaders(objectId);
        expect(objectHeaders['content-type']).to.be.equal('application/json');
      });
      it('BE AWARE (undefined turns into null, because of JSON.stringify)', async () => {
        const dataArrayIn = [1, '2', undefined, null, { d: 2, a: 1 }];
        const dataArrayOut = [1, '2', null, null, { d: 2, a: 1 }];
        const objectId = await objectStorage.add(dataArrayIn);
        expect(typeof objectId).to.be.equal('string');
        const { data } = await objectStorage.getOne(objectId);
        expect(data).to.be.deep.equal(dataArrayOut);
        const objectHeaders = await objectStorage.getHeaders(objectId);
        expect(objectHeaders['content-type']).to.be.equal('application/json');
      });
    });
    describe('with custom headers', () => {
      it('should add with custom headers', async () => {
        const objectId = await objectStorage.add({ a: 2 }, {
          headers: {
            'content-type': 'some-type',
            'x-eio-ttl': 1,
            'x-meta-k': 'v',
            'x-query-k': 'v',
          }
        });
        expect(typeof objectId).to.be.equal('string');
        const { data } = await objectStorage.getOne(objectId);
        expect(data).to.be.deep.equal({ a: 2 });
        const objectWithHeaders = await objectStorage.getHeaders(objectId);
        expect(objectWithHeaders['content-type']).to.be.equal('some-type');
        expect(objectWithHeaders['x-meta-k']).to.be.equal('v');
        expect(objectWithHeaders['x-query-k']).to.be.equal('v');
      });
    });
  });
  describe('get', () => {
    it('should get (default responseType: json)', async () => {
      const objectId = await objectStorage.add({ a: 2 });
      const { data } = await objectStorage.getOne(objectId);
      expect(data).to.be.deep.equal({ a: 2 });
    });
    it('should get (default responseType: json)', async () => {
      const getJSONAsStream = async () => utils.streamFromData({ a: 4 });
      const objectId = await objectStorage.add(getJSONAsStream);
      const { data } = await objectStorage.getOne(objectId);
      expect(data).to.be.deep.equal({ a: 4 });
    });
    it('should throw error (get image as json)', async () => {
      const getAttachAsStream = async () => (await axios.get('https://if0s.info/files/1.jpg', { responseType: 'stream' })).data;
      const objectId = await objectStorage.add(getAttachAsStream);
      await expect(objectStorage.getOne(objectId)).to.be.rejectedWith('Could not parse Maester object as it is not a JSON object');
    });
    xit('should get (default responseType: json)', async () => {
      const getAttachAsStream = async () => (await axios.get('https://if0s.info/files/1.jpg', { responseType: 'stream' })).data;
      const objectId = await objectStorage.add(getAttachAsStream);
      const stream = await objectStorage.getOne(objectId, { responseType: 'stream' });
      stream.pipe(fs.createWriteStream('./a.png'));
    });
  });
  describe('update', () => {
    it('should update (addAsJSON, update as stream)', async () => {
      const dataAsStream = async () => utils.streamFromData({ a: 2 });
      const objId = await objectStorage.add({ a: 3 });
      const resUpdate = await objectStorage.update(objId, dataAsStream);
      const { data } = await objectStorage.getOne(objId);
      expect(data).to.be.deep.equal({ a: 2 });
      expect(resUpdate.contentType).to.be.equal('application/json');
    });
    it('should update (addAsJSON, update as json)', async () => {
      const objId = await objectStorage.add({ a: 3 });
      const resUpdate = await objectStorage.update(objId, { a: 2 });
      const { data } = await objectStorage.getOne(objId);
      expect(data).to.be.deep.equal({ a: 2 });
      expect(resUpdate.contentType).to.be.equal('application/json');
    });
    it('should update (addAsStream, update as stream)', async () => {
      const dataAsStream = async () => utils.streamFromData({ a: 4 });
      const dataAsStream2 = async () => utils.streamFromData({ a: 2 });
      const objId = await objectStorage.add(dataAsStream);
      await objectStorage.update(objId, dataAsStream2);
      const { data } = await objectStorage.getOne(objId);
      expect(data).to.be.deep.equal({ a: 2 });
    });
    it('should update (addAsStream, update as json)', async () => {
      const dataAsStream = async () => utils.streamFromData({ a: 4 });
      const objId = await objectStorage.add(dataAsStream);
      await objectStorage.update(objId, { a: 2 });
      const { data } = await objectStorage.getOne(objId);
      expect(data).to.be.deep.equal({ a: 2 });
    });
    it('should update pdf', async () => {
      const dataAsStream = async () => utils.streamFromData({ a: 4 });
      const objId = await objectStorage.add(dataAsStream);
      const getAttachAsStream2 = async () => (await axios.get('http://www.africau.edu/images/default/sample.pdf', { responseType: 'stream' })).data;
      const resUpd = await objectStorage.update(objId, getAttachAsStream2);
      expect(resUpd.contentType).to.be.equal('application/pdf');
    });
    it('should update with custom content-type', async () => {
      const objectId = await objectStorage.add({ a: 2 });
      await objectStorage.update(objectId, { a: 3 }, { headers: { 'content-type': 'some-type' } });
      const { data } = await objectStorage.getOne(objectId);
      expect(data).to.be.deep.equal({ a: 3 });
      const objectWithHeaders = await objectStorage.getHeaders(objectId);
      expect(objectWithHeaders['content-type']).to.be.equal('some-type');
    });
  });
  describe('deleteOne', () => {
    it('should deleteOne', async () => {
      const getAttachAsStream = async () => utils.streamFromData({ a: 4 });
      const objectId = await objectStorage.add(getAttachAsStream);
      const deletedObject = await objectStorage.deleteOne(objectId);
      expect(deletedObject.data).to.be.equal('');
      await expect(objectStorage.getOne(objectId)).to.be.rejectedWith('Request failed with status code 404');
    });
  });
  describe('deleteAllByParams', () => {
    it('should deleteAllByParams', async () => {
      await objectStorage.add({}, { headers: { 'x-query-t': '123' } });
      await objectStorage.add({}, { headers: { 'x-query-t': '123' } });
      const aliveId = await objectStorage.add({}, { headers: { 'x-query-t': '1234' } });
      const resultBeforeDelete = await objectStorage.getAllByParams({ 'query[t]': '123' });
      expect(resultBeforeDelete.length).to.be.equal(2);
      await objectStorage.deleteAllByParams({ 'query[t]': '123' });
      const resultAfterDelete = await objectStorage.getAllByParams({ 'query[t]': '123' });
      expect(resultAfterDelete.length).to.be.equal(0);
      const { data: aliveData } = await objectStorage.getOne(aliveId);
      expect(aliveData).to.be.deep.equal({});
    });
  });
  describe('getByParams', () => {
    it('should getByParams', async () => {
      const jsonAsStream = async () => utils.streamFromData({ a: 4 });
      const objId1 = await objectStorage.add(jsonAsStream, { headers: { 'x-query-x': '123' } });
      const objId2 = await objectStorage.add(jsonAsStream, { headers: { 'x-query-x': '123' } });
      const objId3 = await objectStorage.add(jsonAsStream, { headers: { 'x-query-x': '1234' } });
      const result = await objectStorage.getAllByParams({ 'query[x]': '123' });
      await objectStorage.deleteOne(objId1);
      await objectStorage.deleteOne(objId2);
      await objectStorage.deleteOne(objId3);
      expect(result.length).to.be.equal(2);
    });
  });
  describe('errors handling', () => {
    let loggingWarnSpy;
    beforeEach(() => {
      loggingWarnSpy = sinon.spy(logging, 'warn');
    });
    afterEach(sinon.restore);
    describe('response with error (4xx)', () => {
      it('should throw 400, no retries', async () => {
        let err: ClientTransportError;
        try {
          await objectStorage.getOne('not-a-uuid');
        } catch (error) {
          err = error;
        }
        expect(err.message).to.be.equal('Client error during request: Request failed with status code 400');
        expect(err instanceof ClientTransportError).to.be.equal(true);
        expect(err.code).to.be.equal(400);
      });
      it('should throw 404, no retries', async () => {
        let err: ClientTransportError;
        try {
          await objectStorage.getOne('2e084a24-e2ea-47c6-a95a-732ec8df7263');
        } catch (error) {
          err = error;
        }
        expect(err.message).to.be.equal('Client error during request: Request failed with status code 404');
        expect(err instanceof ClientTransportError).to.be.equal(true);
        expect(err.code).to.be.equal(404);
      });
    });
    describe('Server error (5xx)', () => {
      beforeEach(() => {
        sinon.stub(utils, 'validateAndGetRetryOptions').callsFake(() => ({ retriesCount: 2, requestTimeout: 1 }));
      });
      it('should throw 5xx', async () => {
        let err: ServerTransportError;
        try {
          await objectStorage.getOne('some-id');
        } catch (error) {
          err = error;
        }
        expect(err.message).to.be.equal('Server error during request: "timeout of 1ms exceeded"');
        expect(err instanceof ServerTransportError).to.be.equal(true);
        expect(loggingWarnSpy.callCount).to.be.equal(2);
        const [{ err: err1 }, log1] = loggingWarnSpy.getCall(0).args;
        expect(err1.toJSON().message).to.be.equal('timeout of 1ms exceeded');
        expect(log1).to.be.equal('Error during object request, retrying (1)');
        const [{ err: err2 }, log2] = loggingWarnSpy.getCall(1).args;
        expect(err2.toJSON().message).to.be.equal('timeout of 1ms exceeded');
        expect(log2).to.be.equal('Error during object request, retrying (2)');
      });
      xit('RUN THIS TEST WITHOUT PORT-FORWARDING', async () => {
        let err: ServerTransportError;
        try {
          await objectStorage.getOne('some-id');
        } catch (error) {
          err = error;
        }
        expect(err.message).to.be.equal('Server error during request: "connect ECONNREFUSED 127.0.0.1:3002"');
        expect(err instanceof ServerTransportError).to.be.equal(true);
        expect(loggingWarnSpy.callCount).to.be.equal(2);
        const [{ err: err1 }, log1] = loggingWarnSpy.getCall(0).args;
        expect(err1.toJSON().message).to.be.equal('connect ECONNREFUSED 127.0.0.1:3002');
        expect(log1).to.be.equal('Error during object request, retrying (1)');
        const [{ err: err2 }, log2] = loggingWarnSpy.getCall(1).args;
        expect(err2.toJSON().message).to.be.equal('connect ECONNREFUSED 127.0.0.1:3002');
        expect(log2).to.be.equal('Error during object request, retrying (2)');
      });
    });
  });
});
