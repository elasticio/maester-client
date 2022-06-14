import sinon from 'sinon';
import { existsSync } from 'fs';
import { config } from 'dotenv';
import chai, { expect } from 'chai';
import aws from 'aws-sdk';
import { Readable } from 'stream';
import FormData from 'form-data';
import axios from 'axios';
import { ObjectStorage } from '../src/ObjectStorage';
import { creds } from './common';
import { streamFromObject } from '../src/utils';

chai.use(require('chai-as-promised'));

describe.only('objectStorage', () => {
  describe('addAsStream', () => {
    it('should addAsStream (image)', async () => {
      const getAttachAsStream = async () => (await axios.get('https://if0s.info/files/1.jpg', { responseType: 'stream' })).data;
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.addAsStream(getAttachAsStream, { contentType: 'image/png' });
      expect(typeof objectId).to.be.equal('string');
    });
    it('should addAsStream (pdf)', async () => {
      const getAttachAsStream = async () => (
        await axios.get('http://environmentclearance.nic.in/writereaddata/FormB/Agenda/2201201642EWMJ8Bpdf18.pdf', { responseType: 'stream' })
      ).data;
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.addAsStream(getAttachAsStream, { contentType: 'application/pdf' });
      expect(typeof objectId).to.be.equal('string');
    });
    it('should addAsStream (json file)', async () => {
      const getAttachAsStream = async () => (
        await axios.get('https://raw.githubusercontent.com/elasticio/jsonata-transform-component/master/package-lock.json', { responseType: 'stream' })
      ).data;
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.addAsStream(getAttachAsStream, { contentType: 'application/json' });
      expect(typeof objectId).to.be.equal('string');
    });
    it('should addAsStream (default "content-type" - application/json', async () => {
      const getJSONAsStream = async () => streamFromObject({ a: 4 });
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.addAsStream(getJSONAsStream);
      expect(typeof objectId).to.be.equal('string');
      const object = await objectStorage.get(objectId);
      expect(object).to.be.deep.equal({ a: 4 });
    });
  });
  describe('addAsJSON', () => {
    it('should addAsJSON', async () => {
      const data = { a: 2 };
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.addAsJSON(data);
      expect(typeof objectId).to.be.equal('string');
      const object = await objectStorage.get(objectId);
      expect(object).to.be.deep.equal(data);
    });
    it('should addAsJSON', async () => {
      const { data } = await axios.get('https://raw.githubusercontent.com/elasticio/jsonata-transform-component/master/package-lock.json');
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.addAsJSON(data);
      expect(typeof objectId).to.be.equal('string');
      const object = await objectStorage.get(objectId);
      expect(object.name).to.be.equal('jsonata-transform-component');
    });
  });
  describe('deleteOne', () => {
    it('should deleteOne', async () => {
      const getAttachAsStream = async () => streamFromObject({ a: 4 });
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.addAsStream(getAttachAsStream);
      const deletedObject = await objectStorage.deleteOne(objectId);
      expect(deletedObject.data).to.be.equal('');
      // @ts-ignore
      await expect(objectStorage.get(objectId)).to.be.rejectedWith('Object Not Found');
    });
  });
  describe('getByParams', () => {
    it('should getByParams', async () => {
      const getAttachAsStream = async () => streamFromObject({ a: 4 });
      const objectStorage = new ObjectStorage(creds);
      const objId1 = await objectStorage.addAsStream(getAttachAsStream, { override: { 'x-query-w': '123' } });
      const objId2 = await objectStorage.addAsStream(getAttachAsStream, { override: { 'x-query-w': '123' } });
      const objId3 = await objectStorage.addAsStream(getAttachAsStream, { override: { 'x-query-w': '1234' } });
      const result = await objectStorage.getAllByParams({ 'query[w]': '123' });
      await objectStorage.deleteOne(objId1);
      await objectStorage.deleteOne(objId2);
      await objectStorage.deleteOne(objId3);
      expect(result.length).to.be.equal(2);
    });
  });
  describe('putAsJSON', () => {
    it('should putAsJSON', async () => {
      const objectStorage = new ObjectStorage(creds);
      const objId = await objectStorage.addAsJSON({ a: 3 });
      await objectStorage.putAsJSON(objId, { a: 2 });
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
    });
    it('should putAsJSON', async () => {
      const objectStorage = new ObjectStorage(creds);
      const dataAsStream = async () => streamFromObject({ a: 4 });
      const objId = await objectStorage.addAsStream(dataAsStream);
      await objectStorage.putAsJSON(objId, { a: 2 });
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
    });
  });
  describe('putAsStream', () => {
    it('should putAsStream', async () => {
      const objectStorage = new ObjectStorage(creds);
      const dataAsStream = async () => streamFromObject({ a: 2 });
      const objId = await objectStorage.addAsJSON({ a: 3 });
      await objectStorage.putAsStream(objId, dataAsStream);
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
    });
    it('should putAsStream', async () => {
      const objectStorage = new ObjectStorage(creds);
      const dataAsStream = async () => streamFromObject({ a: 4 });
      const dataAsStream2 = async () => streamFromObject({ a: 2 });
      const objId = await objectStorage.addAsStream(dataAsStream);
      await objectStorage.putAsStream(objId, dataAsStream2);
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
    });
  });
  describe('put', () => {
    it('should put (addAsJSON, put as stream)', async () => {
      const objectStorage = new ObjectStorage(creds);
      const dataAsStream = async () => streamFromObject({ a: 2 });
      const objId = await objectStorage.addAsJSON({ a: 3 });
      await objectStorage.put(objId, dataAsStream);
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
    });
    it('should put (addAsJSON, put as json)', async () => {
      const objectStorage = new ObjectStorage(creds);
      const objId = await objectStorage.addAsJSON({ a: 3 });
      await objectStorage.put(objId, { a: 2 });
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
    });
    it('should put (addAsStream, put as stream)', async () => {
      const objectStorage = new ObjectStorage(creds);
      const dataAsStream = async () => streamFromObject({ a: 4 });
      const dataAsStream2 = async () => streamFromObject({ a: 2 });
      const objId = await objectStorage.addAsStream(dataAsStream);
      await objectStorage.put(objId, dataAsStream2);
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
    });
    it('should put (addAsStream, put as json)', async () => {
      const objectStorage = new ObjectStorage(creds);
      const dataAsStream = async () => streamFromObject({ a: 4 });
      const objId = await objectStorage.addAsStream(dataAsStream);
      await objectStorage.put(objId, { a: 2 });
      const object = await objectStorage.get(objId);
      expect(object).to.be.deep.equal({ a: 2 });
    });
  });
});
