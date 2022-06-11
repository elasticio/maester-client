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

describe('addAsStream', () => {
  describe('addAsStream', () => {
    it('should addAsStream', async () => {
      const getAttachAsStream = async () => (await axios.get('https://if0s.info/files/1.jpg', { responseType: 'stream' })).data;
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.addAsStream(getAttachAsStream, { contentType: 'image/png' });
      expect(typeof objectId).to.be.equal('string');
    });
    it('should addAsStream', async () => {
      const getAttachAsStream = async () => (
        await axios.get('https://file-examples.com/storage/fece7372cf62a47bc9626b9/2017/10/file-example_PDF_500_kB.pdf', { responseType: 'stream' })
      ).data;
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.addAsStream(getAttachAsStream, { contentType: 'application/pdf' });
      expect(typeof objectId).to.be.equal('string');
    });
    it('should addAsStream', async () => {
      const getAttachAsStream = async () => (
        await axios.get('https://raw.githubusercontent.com/elasticio/jsonata-transform-component/master/package-lock.json', { responseType: 'stream' })
      ).data;
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.addAsStream(getAttachAsStream, { contentType: 'application/json' });
      expect(typeof objectId).to.be.equal('string');
    });
    it('should addAsStream (default "content-type" - application/json', async () => {
      const getAttachAsStream = async () => streamFromObject({ a: 4 });
      const objectStorage = new ObjectStorage(creds);
      const objectId = await objectStorage.addAsStream(getAttachAsStream);
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
});
