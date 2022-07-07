import chai, { expect } from 'chai';
import axios from 'axios';
import sinon from 'sinon';
import fs from 'fs';
import { creds } from './common';
import * as utils from '../src/utils';
import logging from '../src/logger';
import { ObjectStorage } from '../src';

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
        const object = await objectStorage.getOne(objectId);
        expect(JSON.parse(object)).to.be.deep.equal({ a: 4 });
      });
    });
    describe('as any', () => {
      it('should add (JSON)', async () => {
        const objectId = await objectStorage.add({ a: 2 });
        expect(typeof objectId).to.be.equal('string');
        const object = await objectStorage.getOne(objectId);
        expect(JSON.parse(object)).to.be.deep.equal({ a: 2 });
      });
      it('should add array', async () => {
        const dataArray = [1, '2', null, { d: 2, a: 1 }];
        const objectId = await objectStorage.add(dataArray);
        expect(typeof objectId).to.be.equal('string');
        const object = await objectStorage.getOne(objectId);
        expect(JSON.parse(object)).to.be.deep.equal(dataArray);
      });
      it('should add string', async () => {
        const dataString = 'hurray';
        const objectId = await objectStorage.add(dataString);
        expect(typeof objectId).to.be.equal('string');
        const object = await objectStorage.getOne(objectId);
        expect(JSON.parse(object)).to.be.deep.equal(dataString);
      });
      it('should add number', async () => {
        const dataNumber = 56;
        const objectId = await objectStorage.add(dataNumber);
        expect(typeof objectId).to.be.equal('string');
        const object = await objectStorage.getOne(objectId);
        expect(JSON.parse(object)).to.be.deep.equal(dataNumber);
      });
      it('should add null', async () => {
        const objectId = await objectStorage.add(null);
        expect(typeof objectId).to.be.equal('string');
        const object = await objectStorage.getOne(objectId);
        expect(JSON.parse(object)).to.be.deep.equal(null);
      });
      it('BE AWARE (undefined turns into null, because of JSON.stringify)', async () => {
        const dataArrayIn = [1, '2', undefined, null, { d: 2, a: 1 }];
        const dataArrayOut = [1, '2', null, null, { d: 2, a: 1 }];
        const objectId = await objectStorage.add(dataArrayIn);
        expect(typeof objectId).to.be.equal('string');
        const object = await objectStorage.getOne(objectId);
        expect(JSON.parse(object)).to.be.deep.equal(dataArrayOut);
      });
    });
  });
  describe('get', () => {
    it('should get (default responseType: json)', async () => {
      const objectId = await objectStorage.add({ a: 2 });
      const object = await objectStorage.getOne(objectId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 2 });
    });
    it('should get (default responseType: json)', async () => {
      const getJSONAsStream = async () => utils.streamFromData({ a: 4 });
      const objectId = await objectStorage.add(getJSONAsStream);
      const object = await objectStorage.getOne(objectId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 4 });
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
      const object = await objectStorage.getOne(objId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 2 });
      expect(resUpdate.contentType).to.be.equal('application/json');
    });
    it('should update (addAsJSON, update as json)', async () => {
      const objId = await objectStorage.add({ a: 3 });
      const resUpdate = await objectStorage.update(objId, { a: 2 });
      const object = await objectStorage.getOne(objId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 2 });
      expect(resUpdate.contentType).to.be.equal('application/json');
    });
    it('should update (addAsStream, update as stream)', async () => {
      const dataAsStream = async () => utils.streamFromData({ a: 4 });
      const dataAsStream2 = async () => utils.streamFromData({ a: 2 });
      const objId = await objectStorage.add(dataAsStream);
      await objectStorage.update(objId, dataAsStream2);
      const object = await objectStorage.getOne(objId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 2 });
    });
    it('should update (addAsStream, update as json)', async () => {
      const dataAsStream = async () => utils.streamFromData({ a: 4 });
      const objId = await objectStorage.add(dataAsStream);
      await objectStorage.update(objId, { a: 2 });
      const object = await objectStorage.getOne(objId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 2 });
    });
    it('should update pdf', async () => {
      const getAttachAsStream = async () => (
        await axios.get('http://environmentclearance.nic.in/writereaddata/FormB/Agenda/2201201642EWMJ8Bpdf18.pdf', { responseType: 'stream' })
      ).data;
      const objId = await objectStorage.add(getAttachAsStream);
      const getAttachAsStream2 = async () => (await axios.get('http://www.africau.edu/images/default/sample.pdf', { responseType: 'stream' })).data;
      const resUpd = await objectStorage.update(objId, getAttachAsStream2);
      expect(resUpd.contentType).to.be.equal('application/pdf');
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
      await objectStorage.add({}, { override: { 'x-query-t': '123' } });
      await objectStorage.add({}, { override: { 'x-query-t': '123' } });
      const aliveId = await objectStorage.add({}, { override: { 'x-query-t': '1234' } });
      const resultBeforeDelete = await objectStorage.getAllByParams({ 'query[t]': '123' });
      expect(JSON.parse(resultBeforeDelete).length).to.be.equal(2);
      await objectStorage.deleteAllByParams({ 'query[t]': '123' });
      const resultAfterDelete = await objectStorage.getAllByParams({ 'query[t]': '123' });
      expect(JSON.parse(resultAfterDelete).length).to.be.equal(0);
      const aliveObject = await objectStorage.getOne(aliveId);
      expect(JSON.parse(aliveObject)).to.be.deep.equal({});
    });
  });
  describe('getByParams', () => {
    it('should getByParams', async () => {
      const jsonAsStream = async () => utils.streamFromData({ a: 4 });
      const objId1 = await objectStorage.add(jsonAsStream, { override: { 'x-query-x': '123' } });
      const objId2 = await objectStorage.add(jsonAsStream, { override: { 'x-query-x': '123' } });
      const objId3 = await objectStorage.add(jsonAsStream, { override: { 'x-query-x': '1234' } });
      const result = await objectStorage.getAllByParams({ 'query[x]': '123' });
      await objectStorage.deleteOne(objId1);
      await objectStorage.deleteOne(objId2);
      await objectStorage.deleteOne(objId3);
      expect(JSON.parse(result).length).to.be.equal(2);
    });
  });
  describe('errors handling', () => {
    let loggingTraceSpy;
    let loggingWarnSpy;
    beforeEach(() => {
      loggingTraceSpy = sinon.spy(logging, 'trace');
      loggingWarnSpy = sinon.spy(logging, 'warn');
    });
    afterEach(sinon.restore);
    describe('response with error (4xx)', () => {
      it('should throw 400, no retries', async () => {
        await expect(objectStorage.getOne('not-a-uuid')).to.be.rejectedWith('Request failed with status code 400');
        expect(loggingTraceSpy.callCount).to.be.equal(1);
      });
      it('should throw 404, no retries', async () => {
        await expect(objectStorage.getOne('2e084a24-e2ea-47c6-a95a-732ec8df7263')).to.be.rejectedWith('Request failed with status code 404');
        expect(loggingTraceSpy.callCount).to.be.equal(1);
      });
    });
    describe('Server error (5xx)', () => {
      beforeEach(() => {
        sinon.stub(utils, 'validateRetryOptions').callsFake(() => ({ retryDelay: 1, retriesCount: 2, requestTimeout: 1 }));
      });
      it('should throw 5xx', async () => {
        await expect(objectStorage.getOne('some-id')).to.be.rejectedWith('Server error during request: "timeout of 1ms exceeded"');
        expect(loggingTraceSpy.callCount).to.be.equal(3);
        expect(loggingWarnSpy.callCount).to.be.equal(2);
        const [{ err: err1 }, log1] = loggingWarnSpy.getCall(0).args;
        expect(err1.toJSON().message).to.be.equal('timeout of 1ms exceeded');
        expect(log1).to.be.equal('Error during object request, retrying (1)');
        const [{ err: err2 }, log2] = loggingWarnSpy.getCall(1).args;
        expect(err2.toJSON().message).to.be.equal('timeout of 1ms exceeded');
        expect(log2).to.be.equal('Error during object request, retrying (2)');
      });
      xit('RUN THIS TEST WITHOUT PORT-FORWARDING', async () => {
        await expect(objectStorage.getOne('some-id')).to.be.rejectedWith('Server error during request: "connect ECONNREFUSED 127.0.0.1:3002"');
        expect(loggingTraceSpy.callCount).to.be.equal(3);
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
