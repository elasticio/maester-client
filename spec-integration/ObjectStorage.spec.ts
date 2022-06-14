import sinon from 'sinon';
import fs, { existsSync } from 'fs';
import { config } from 'dotenv';
import chai, { expect } from 'chai';
import { Readable } from 'stream';
import FormData from 'form-data';
import axios from 'axios';
import { ObjectStorage } from '../src/ObjectStorage';
import { creds } from './common';
import { sleep, streamFromObject } from '../src/utils';

chai.use(require('chai-as-promised'));

describe.only('objectStorage', () => {
  describe('add', () => {
    it('should add (stream) (image)', async () => {
      const getAttachAsStream = async () => (await axios.get('https://if0s.info/files/1.jpg', { responseType: 'stream' })).data;
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.add(getAttachAsStream, { contentType: 'image/png' });
      expect(typeof objectId).to.be.equal('string');
    });
    it('should add (stream) (pdf)', async () => {
      const getAttachAsStream = async () => (
        await axios.get('http://environmentclearance.nic.in/writereaddata/FormB/Agenda/2201201642EWMJ8Bpdf18.pdf', { responseType: 'stream' })
      ).data;
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.add(getAttachAsStream, { contentType: 'application/pdf' });
      console.log(objectId);
      expect(typeof objectId).to.be.equal('string');
    });
    it('should add (stream) (json file)', async () => {
      const getAttachAsStream = async () => (
        await axios.get('https://raw.githubusercontent.com/elasticio/jsonata-transform-component/master/package-lock.json', { responseType: 'stream' })
      ).data;
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.add(getAttachAsStream, { contentType: 'application/json' });
      expect(typeof objectId).to.be.equal('string');
    });
    xit('should add (stream) (default "content-type" - application/json)', async () => {
      const getJSONAsStream = async () => streamFromObject({ a: 4 });
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.add(getJSONAsStream);
      expect(typeof objectId).to.be.equal('string');
      const object = await objectStorage.get(objectId);
      expect(object).to.be.deep.equal({ a: 4 });
    });
    xit('should add (JSON)', async () => {
      const data = { a: 2 };
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.add(data);
      expect(typeof objectId).to.be.equal('string');
      const object = await objectStorage.get(objectId);
      expect(object).to.be.deep.equal(data);
    });
    xit('should add (JSON) (default "content-type" - application/json)', async () => {
      const { data } = await axios.get('https://raw.githubusercontent.com/elasticio/jsonata-transform-component/master/package-lock.json');
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.add(data);
      expect(typeof objectId).to.be.equal('string');
      const object = await objectStorage.get(objectId);
      expect(object.name).to.be.equal('jsonata-transform-component');
    });
  });
  xdescribe('get', () => {
    it('should get (default responseType: stream)', async () => {
      const getAttachAsStream = async () => (await axios.get('http://environmentclearance.nic.in/writereaddata/FormB/Agenda/2201201642EWMJ8Bpdf18.pdf',
        { responseType: 'stream' })
      ).data;
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.add(getAttachAsStream, { contentType: 'application/pdf' });
    });
  });
  xdescribe('update', () => {
    it('should update (addAsJSON, update as stream)', async () => {
      const objectStorage = new ObjectStorage(creds);
      const dataAsStream = async () => streamFromObject({ a: 2 });
      const objId = await objectStorage.add({ a: 3 });
      const resUpdate = await objectStorage.update(objId, dataAsStream);
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
      expect(resUpdate.contentType).to.be.equal('application/json');
    });
    it('should update (addAsJSON, update as json)', async () => {
      const objectStorage = new ObjectStorage(creds);
      const objId = await objectStorage.add({ a: 3 });
      const resUpdate = await objectStorage.update(objId, { a: 2 });
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
      expect(resUpdate.contentType).to.be.equal('application/json');
    });
    it('should update (addAsStream, update as stream)', async () => {
      const objectStorage = new ObjectStorage(creds);
      const dataAsStream = async () => streamFromObject({ a: 4 });
      const dataAsStream2 = async () => streamFromObject({ a: 2 });
      const objId = await objectStorage.add(dataAsStream);
      await objectStorage.update(objId, dataAsStream2);
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
    });
    it('should update (addAsStream, update as json)', async () => {
      const objectStorage = new ObjectStorage(creds);
      const dataAsStream = async () => streamFromObject({ a: 4 });
      const objId = await objectStorage.add(dataAsStream);
      await objectStorage.update(objId, { a: 2 });
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
    });
    it('should update pdf', async () => {
      const objectStorage = new ObjectStorage(creds);
      const getAttachAsStream = async () => (
        await axios.get('http://environmentclearance.nic.in/writereaddata/FormB/Agenda/2201201642EWMJ8Bpdf18.pdf', { responseType: 'stream' })
      ).data;
      const objId = await objectStorage.add(getAttachAsStream, { contentType: 'application/pdf' });
      const getAttachAsStream2 = async () => (await axios.get('http://www.africau.edu/images/default/sample.pdf', { responseType: 'stream' })).data;
      const resUpd = await objectStorage.update(objId, getAttachAsStream2, { contentType: 'application/pdf' });
      await objectStorage.get(objId);
      expect(resUpd.contentType).to.be.equal('application/pdf');
    });
  });
  xdescribe('deleteOne', () => {
    it('should deleteOne', async () => {
      const getAttachAsStream = async () => streamFromObject({ a: 4 });
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.add(getAttachAsStream);
      const deletedObject = await objectStorage.deleteOne(objectId);
      expect(deletedObject.data).to.be.equal('');
      // @ts-ignore
      await expect(objectStorage.get(objectId)).to.be.rejectedWith('Object Not Found');
    });
  });
  xdescribe('getByParams', () => {
    it('should getByParams', async () => {
      const getAttachAsStream = async () => streamFromObject({ a: 4 });
      const objectStorage = new ObjectStorage(creds);
      const objId1 = await objectStorage.add(getAttachAsStream, { override: { 'x-query-w': '123' } });
      const objId2 = await objectStorage.add(getAttachAsStream, { override: { 'x-query-w': '123' } });
      const objId3 = await objectStorage.add(getAttachAsStream, { override: { 'x-query-w': '1234' } });
      const result = await objectStorage.getAllByParams({ 'query[w]': '123' });
      await objectStorage.deleteOne(objId1);
      await objectStorage.deleteOne(objId2);
      await objectStorage.deleteOne(objId3);
      expect(result.length).to.be.equal(2);
    });
  });
});
