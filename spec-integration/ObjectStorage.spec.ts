import chai, { expect } from 'chai';
import axios from 'axios';
import fs from 'fs';
import { ObjectStorage } from '../src';
import { creds } from './common';
import { streamFromObject } from '../src/utils';

chai.use(require('chai-as-promised'));

describe('objectStorage', () => {
  const objectStorage = new ObjectStorage(creds);
  describe('add', () => {
    it('should add (image)', async () => {
      const getAttachAsStream = async () => (await axios.get('https://if0s.info/files/1.jpg', { responseType: 'stream' })).data;
      const objectId = await objectStorage.add(getAttachAsStream, { contentType: 'image/png' });
      expect(typeof objectId).to.be.equal('string');
    });
    it('should add (pdf)', async () => {
      const getAttachAsStream = async () => (
        await axios.get('http://environmentclearance.nic.in/writereaddata/FormB/Agenda/2201201642EWMJ8Bpdf18.pdf', { responseType: 'stream' })
      ).data;
      const objectId = await objectStorage.add(getAttachAsStream, { contentType: 'application/pdf' });
      expect(typeof objectId).to.be.equal('string');
    });
    it('should add (json file)', async () => {
      const getAttachAsStream = async () => (
        await axios.get('https://raw.githubusercontent.com/elasticio/jsonata-transform-component/master/package-lock.json', { responseType: 'stream' })
      ).data;
      const objectId = await objectStorage.add(getAttachAsStream, { contentType: 'application/json' });
      expect(typeof objectId).to.be.equal('string');
    });
    it('should add (default "content-type" - application/json)', async () => {
      const getJSONAsStream = async () => streamFromObject({ a: 4 });
      const objectId = await objectStorage.add(getJSONAsStream);
      expect(typeof objectId).to.be.equal('string');
      const object = await objectStorage.getOne(objectId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 4 });
    });
    it('should add (JSON)', async () => {
      const objectId = await objectStorage.add({ a: 2 });
      expect(typeof objectId).to.be.equal('string');
      const object = await objectStorage.getOne(objectId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 2 });
    });
  });
  describe('get', () => {
    it('should get (default responseType: json)', async () => {
      const objectId = await objectStorage.add({ a: 2 });
      const object = await objectStorage.getOne(objectId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 2 });
    });
    it('should get (default responseType: json)', async () => {
      const getJSONAsStream = async () => streamFromObject({ a: 4 });
      const objectId = await objectStorage.add(getJSONAsStream);
      const object = await objectStorage.getOne(objectId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 4 });
    });
    xit('should get (default responseType: json)', async () => {
      const getAttachAsStream = async () => (await axios.get('https://if0s.info/files/1.jpg', { responseType: 'stream' })).data;
      const objectId = await objectStorage.add(getAttachAsStream, { contentType: 'image/png' });
      const stream = await objectStorage.getOne(objectId, { responseType: 'stream' });
      stream.pipe(fs.createWriteStream('./a.png'));
    });
  });
  describe('update', () => {
    it('should update (addAsJSON, update as stream)', async () => {
      const dataAsStream = async () => streamFromObject({ a: 2 });
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
      const dataAsStream = async () => streamFromObject({ a: 4 });
      const dataAsStream2 = async () => streamFromObject({ a: 2 });
      const objId = await objectStorage.add(dataAsStream);
      await objectStorage.update(objId, dataAsStream2);
      const object = await objectStorage.getOne(objId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 2 });
    });
    it('should update (addAsStream, update as json)', async () => {
      const dataAsStream = async () => streamFromObject({ a: 4 });
      const objId = await objectStorage.add(dataAsStream);
      await objectStorage.update(objId, { a: 2 });
      const object = await objectStorage.getOne(objId);
      expect(JSON.parse(object)).to.be.deep.equal({ a: 2 });
    });
    it('should update pdf', async () => {
      const getAttachAsStream = async () => (
        await axios.get('http://environmentclearance.nic.in/writereaddata/FormB/Agenda/2201201642EWMJ8Bpdf18.pdf', { responseType: 'stream' })
      ).data;
      const objId = await objectStorage.add(getAttachAsStream, { contentType: 'application/pdf' });
      const getAttachAsStream2 = async () => (await axios.get('http://www.africau.edu/images/default/sample.pdf', { responseType: 'stream' })).data;
      const resUpd = await objectStorage.update(objId, getAttachAsStream2, { contentType: 'application/pdf' });
      expect(resUpd.contentType).to.be.equal('application/pdf');
    });
  });
  describe('deleteOne', () => {
    it('should deleteOne', async () => {
      const getAttachAsStream = async () => streamFromObject({ a: 4 });
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
      const jsonAsStream = async () => streamFromObject({ a: 4 });
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
