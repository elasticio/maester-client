import chai, { expect } from 'chai';
import axios from 'axios';
import getStream from 'get-stream';
import { StorageClient } from '../src';
import { creds } from './common';
import { streamFromData } from '../src/utils';

chai.use(require('chai-as-promised'));

describe('objectStorage', () => {
  const storageClient = new StorageClient(creds);
  describe('add & get', () => {
    it('should add (defaults to application/json)', async () => {
      const getJSONAsStream = async () => streamFromData({ a: 4 });
      const { data } = await storageClient.post(getJSONAsStream);
      expect(data.contentType).to.be.equal('application/json');
      const response = await storageClient.get(data.objectId, {});
      const rawResp = await getStream(response.data);
      expect(JSON.parse(rawResp)).to.be.deep.equal({ a: 4 });
    });
    it('should add (application/json)', async () => {
      const getJSONAsStream = async () => streamFromData({ a: 3 });
      const { data } = await storageClient.post(getJSONAsStream);
      expect(data.contentType).to.be.equal('application/json');
      const response = await storageClient.get(data.objectId, { responseType: 'json' });
      const rawResp = await getStream(response.data);
      expect(JSON.parse(rawResp)).to.be.deep.equal({ a: 3 });
    });
    it('should add (defaults to application/json)', async () => {
      const getAttachAsStream = async () => (
        await axios.get('https://raw.githubusercontent.com/elasticio/jsonata-transform-component/master/package-lock.json', { responseType: 'stream' })
      ).data;
      const { data } = await storageClient.post(getAttachAsStream);
      expect(data.contentType).to.be.equal('application/json');
      const response = await storageClient.get(data.objectId, {});
      const rawResp = await getStream(response.data);
      expect(JSON.parse(rawResp).name).to.be.equal('jsonata-transform-component');
    });
  });
});
