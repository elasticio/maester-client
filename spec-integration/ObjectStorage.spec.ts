import sinon from 'sinon';
import { existsSync } from 'fs';
import { config } from 'dotenv';
import chai, { expect } from 'chai';
import { Readable } from 'stream';
import axios from 'axios';
import { ObjectStorage } from '../src/ObjectStorage';
import { creds } from './common';

chai.use(require('chai-as-promised'));

describe('addAsStream', () => {
  it('should addAsStream', async () => {
    const getAttachAsStream = async () => (await axios.get('https://if0s.info/files/1.jpg', { responseType: 'stream' })).data;
    const objectStorage = new ObjectStorage(creds);
    const result = await objectStorage.addAsStream(getAttachAsStream, { contentType: 'image/png' });
    console.log(result);
    // expect(batchWithItem.items).to.be.deep.equal([batchItem]);
  });
});
