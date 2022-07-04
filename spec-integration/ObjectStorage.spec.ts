import chai, { expect } from 'chai';
import axios from 'axios';
import fs from 'fs';
import { ObjectStorage } from '../src';
import { creds } from './common';
import { streamFromData } from '../src/utils';

chai.use(require('chai-as-promised'));

describe('objectStorag e', () => {
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
        const getJSONAsStream = async () => streamFromData({ a: 4 });
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
      const getJSONAsStream = async () => streamFromData({ a: 4 });
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
      const dataAsStream = async () => streamFromData({ a: 2 });
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
      const dataAsStream = async () => streamFromData({ a: 4 });
      const dataAsStream2 = async () => streamFromData({ a: 2 });
      const objId = await objectStorage.add(dataAsStream);
      await objectStorage.update(objId, dataAsStream2);
      const object = await objectStorage.getOne(objId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 2 });
    });
    it('should update (addAsStream, update as json)', async () => {
      const dataAsStream = async () => streamFromData({ a: 4 });
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
      const getAttachAsStream = async () => streamFromData({ a: 4 });
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
      const jsonAsStream = async () => streamFromData({ a: 4 });
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
});
