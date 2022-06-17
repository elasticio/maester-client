import axios from 'axios';
import chai, { expect } from 'chai';
import { Readable } from 'stream';
import { getStreamContentType } from '../src/StorageClient';
import { streamFromObject } from '../src/utils';

// const formStream = async (data: object): Promise<Readable> => {
//   const dataString = JSON.stringify(data);
//   const stream = new Readable();
//   stream.push(dataString);
//   stream.push(null);
//   return stream;
// };

describe('getStreamContentType', () => {
  it('should getStreamContentType', async () => {
    const contentType = await getStreamContentType(await streamFromObject({ a: 4 }));
    expect(contentType).to.be.equal('application/json');
  });
  it('should getStreamContentType', async () => {
    const { data } = await axios.get('https://if0s.info/files/1.jpg', { responseType: 'stream' });
    const contentType = await getStreamContentType(data);
    expect(contentType).to.be.equal('image/png');
  });
  it('should getStreamContentType', async () => {
    const { data } = await axios.get('https://raw.githubusercontent.com/elasticio/jsonata-transform-component/master/package-lock.json', { responseType: 'stream' });
    const contentType = await getStreamContentType(data);
    expect(contentType).to.be.equal('application/json');
  });
  it('should getStreamContentType', async () => {
    const { data } = await axios.get('http://environmentclearance.nic.in/writereaddata/FormB/Agenda/2201201642EWMJ8Bpdf18.pdf', { responseType: 'stream' });
    const contentType = await getStreamContentType(data);
    expect(contentType).to.be.equal('application/pdf');
  });
});
