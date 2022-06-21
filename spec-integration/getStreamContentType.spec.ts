import axios from 'axios';
import { expect } from 'chai';
import { getStreamWithContentType } from '../src/StorageClient';
import { streamFromData } from '../src/utils';

describe('getStreamWithContentType', () => {
  it('should getStreamWithContentType', async () => {
    const getJsonAsStream = async () => streamFromData({ a: 4 });
    const { mime } = await getStreamWithContentType(getJsonAsStream);
    expect(mime).to.be.equal('application/json');
  });
  it('should getStreamWithContentType', async () => {
    const getAttachAsStream = async () => (await axios.get('https://if0s.info/files/1.jpg', { responseType: 'stream' })).data;
    const { mime } = await getStreamWithContentType(getAttachAsStream);
    expect(mime).to.be.equal('image/jpeg');
  });
  it('should getStreamWithContentType', async () => {
    const getAttachAsStream = async () => (
      await axios.get('https://raw.githubusercontent.com/elasticio/jsonata-transform-component/master/package-lock.json', { responseType: 'stream' })
    ).data;
    const { mime } = await getStreamWithContentType(getAttachAsStream);
    expect(mime).to.be.equal('application/json');
  });
  it('should getStreamWithContentType', async () => {
    const getAttachAsStream = async () => (
      await axios.get('http://environmentclearance.nic.in/writereaddata/FormB/Agenda/2201201642EWMJ8Bpdf18.pdf', { responseType: 'stream' })
    ).data;
    const { mime } = await getStreamWithContentType(getAttachAsStream);
    expect(mime).to.be.equal('application/pdf');
  });
});
