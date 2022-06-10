// /* eslint-disable no-unused-expressions */
// import nock from 'nock';
// import sinonjs, { SinonSandbox } from 'sinon';
// import { expect } from 'chai';
// import {
//   describe, beforeEach, afterEach, it,
// } from 'mocha';
// import { Readable } from 'stream';
// import { ObjectStorage } from '../src/ObjectStorage';
// import logging from '../src/logger';
// import {
//   streamResponse, encryptStream, decryptStream, zip, unzip,
// } from './helpers';


// const formStream = (dataString: string): Readable => {
//   const stream = new Readable();
//   stream.push(dataString);
//   stream.push(null);
//   return stream;
// };

// xdescribe('Object Storage', () => {
//   const config = {
//     uri: 'https://ma.es.ter',
//     jwtSecret: 'jwt',
//   };

//   const postData = { test: 'test' };

//   const responseData = {
//     contentLength: 'meta.contentLength',
//     contentType: 'meta.contentType',
//     createdAt: 'meta.createdAt',
//     md5: 'meta.md5Hash',
//     objectId: 'obj.id',
//     metadata: 'meta.userMetadata',
//   };
//   // eslint-disable-next-line max-len
//   const responseString = '{"contentLength":"meta.contentLength","contentType":"meta.contentType",
// "createdAt":"meta.createdAt","md5":"meta.md5Hash","objectId":"obj.id","metadata":"meta.userMetadata"}';

//   let sinon: SinonSandbox;
//   beforeEach(async () => {
//     sinon = sinonjs.createSandbox();
//   });
//   afterEach(() => {
//     sinon.restore();
//   });

//   describe('basic', () => {
//     describe('data mode', () => {
//       it('should getAllByParams', async () => {
//         const objectStorage = new ObjectStorage(config);

//         const objectStorageCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .get('/objects?foo=bar')
//           .reply(200, {});

//         await objectStorage.getAllByParams({ foo: 'bar' });

//         expect(objectStorageCalls.isDone()).to.be.true;
//       });

//       it('should getById (stream)', async () => {
//         const objectStorage = new ObjectStorage(config);

//         const objectStorageCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .get('/objects/objectId')
//           .reply(200, formStream('i`m a stream'));

//         const result = await objectStorage.getById('objectId', 'stream');
//         expect(result.toString('base64')).to.be.equal(formStream('i`m a stream').toString());
//         expect(objectStorageCalls.isDone()).to.be.true;
//       });

//       it('should getById (json)', async () => {
//         const objectStorage = new ObjectStorage(config);

//         const objectStorageCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .get('/objects/objectId')
//           .reply(200, formStream('i`m a stream'));

//         const result = await objectStorage.getById('objectId', 'json');
//         expect(result).to.be.deep.equal('i`m a stream');
//         expect(objectStorageCalls.isDone()).to.be.true;
//       });

//       it('should getById (arraybuffer)', async () => {
//         const objectStorage = new ObjectStorage(config);

//         const objectStorageCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .get('/objects/objectId')
//           .reply(200, formStream('i`m a stream'));

//         const result = await objectStorage.getById('objectId', 'arraybuffer');
//         const encodedResult = Buffer.from('i`m a stream', 'binary').toString('base64');
//         expect(result.toString('base64')).to.be.equal(encodedResult);
//         expect(objectStorageCalls.isDone()).to.be.true;
//       });
//     });

//     describe('stream mode', () => {
//       it('should fail after 3 get retries', async () => {
//         const log = sinon.stub(logging, 'warn');
//         const objectStorage = new ObjectStorage(config);

//         const objectStorageCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .get('/objects/1')
//           .replyWithError({ code: 'ETIMEDOUT' })
//           .get('/objects/1')
//           .reply(404)
//           .get('/objects/1')
//           .replyWithError({ code: 'ENOTFOUND' });

//         let err;
//         try {
//           await objectStorage.getById('1');
//         } catch (e) {
//           err = e;
//         }

//         expect(objectStorageCalls.isDone()).to.be.true;
//         expect(err.code).to.be.equal('ENOTFOUND');
//         expect(log.getCall(1).args[1].toString()).to.include('404');
//         expect(log.callCount).to.be.equal(2);
//       });

//       it('should retry get request on errors', async () => {
//         const objectStorage = new ObjectStorage(config);

//         const objectStorageCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .get('/objects/1')
//           .reply(500)
//           .get('/objects/1')
//           .reply(200, streamResponse(responseData));

//         const response = await objectStorage.getById('1');

//         expect(objectStorageCalls.isDone()).to.be.true;
//         expect(response).to.be.deep.equal(responseString);
//       });

//       it('should throw an error on post request connection error', async () => {
//         const objectStorage = new ObjectStorage(config);

//         const objectStorageCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .post('/objects')
//           .replyWithError({ code: 'ECONNREFUSED' })
//           .post('/objects')
//           .replyWithError({ code: 'ECONNREFUSED' })
//           .post('/objects')
//           .replyWithError({ code: 'ECONNREFUSED' });

//         let err;
//         try {
//           await objectStorage.postObject(postData, {});
//         } catch (e) {
//           err = e;
//         }

//         expect(objectStorageCalls.isDone()).to.be.true;
//         expect(err.code).to.be.equal('ECONNREFUSED');
//       });

//       it('should throw an error on post request http error', async () => {
//         const objectStorage = new ObjectStorage(config);

//         const objectStorageCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .post('/objects')
//           .reply(409)
//           .post('/objects')
//           .reply(409)
//           .post('/objects')
//           .reply(409);

//         let err;
//         try {
//           await objectStorage.postObject(postData, {});
//         } catch (e) {
//           err = e;
//         }
//         expect(objectStorageCalls.isDone()).to.be.true;
//         expect(err.toString()).to.include('409');
//       });

//       it('should post successfully', async () => {
//         const objectStorage = new ObjectStorage(config);

//         const objectStorageCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .post('/objects')
//           .reply(200);

//         const response: any = await objectStorage.postObject(postData, {});

//         expect(objectStorageCalls.isDone()).to.be.true;
//         expect(response.objectId).to.match(/^[0-9a-z-]+$/);
//       });
//     });
//   });

//   describe('middlewares + zip/unzip and encrypt/decrypt', () => {
//     describe('stream mode', () => {
//       it('should fail after 3 get retries', async () => {
//         const objectStorageWithMiddlewares = new ObjectStorage(config);
//         objectStorageWithMiddlewares.use(encryptStream, decryptStream);
//         objectStorageWithMiddlewares.use(zip, unzip);
//         const log = sinon.stub(logging, 'warn');
//         const objectStorageWithMiddlewaresCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .get('/objects/1')
//           .replyWithError({ code: 'ETIMEDOUT' })
//           .get('/objects/1')
//           .reply(404)
//           .get('/objects/1')
//           .replyWithError({ code: 'ENOTFOUND' });

//         let err;
//         try {
//           await objectStorageWithMiddlewares.getById('1');
//         } catch (e) {
//           err = e;
//         }

//         expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
//         expect(err.code).to.be.equal('ENOTFOUND');
//         expect(log.getCall(1).args[1].toString()).to.include('404');
//         expect(log.callCount).to.be.equal(2);
//       });

//       it('should retry get request on errors', async () => {
//         const objectStorageWithMiddlewares = new ObjectStorage(config);
//         objectStorageWithMiddlewares.use(encryptStream, decryptStream);
//         objectStorageWithMiddlewares.use(zip, unzip);
//         const objectStorageWithMiddlewaresCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .get('/objects/1')
//           .reply(500)
//           .get('/objects/1')
//           .reply(200, () => {
//             const stream = streamResponse(responseData)();
//             return stream.pipe(encryptStream()).pipe(zip());
//           });

//         const response = await objectStorageWithMiddlewares.getById('1');

//         expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
//         expect(response).to.be.deep.equal(responseString);
//       });

//       it('should throw an error on post request connection error', async () => {
//         const objectStorageWithMiddlewares = new ObjectStorage(config);
//         objectStorageWithMiddlewares.use(encryptStream, decryptStream);
//         objectStorageWithMiddlewares.use(zip, unzip);
//         const objectStorageWithMiddlewaresCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .post('/objects')
//           .replyWithError({ code: 'ECONNREFUSED' })
//           .post('/objects')
//           .replyWithError({ code: 'ECONNREFUSED' })
//           .post('/objects')
//           .replyWithError({ code: 'ECONNREFUSED' });

//         let err;
//         try {
//           await objectStorageWithMiddlewares.postObject(postData, {});
//         } catch (e) {
//           err = e;
//         }

//         expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
//         expect(err.code).to.be.equal('ECONNREFUSED');
//       });

//       it('should throw an error on post request http error', async () => {
//         const objectStorageWithMiddlewares = new ObjectStorage(config);
//         objectStorageWithMiddlewares.use(encryptStream, decryptStream);
//         objectStorageWithMiddlewares.use(zip, unzip);
//         const objectStorageWithMiddlewaresCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .post('/objects')
//           .reply(409)
//           .post('/objects')
//           .reply(409)
//           .post('/objects')
//           .reply(409);

//         let err;
//         try {
//           await objectStorageWithMiddlewares.postObject(postData, {});
//         } catch (e) {
//           err = e;
//         }
//         expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
//         expect(err.toString()).to.include('409');
//       });

//       it('should post successfully', async () => {
//         const objectStorageWithMiddlewares = new ObjectStorage(config);
//         objectStorageWithMiddlewares.use(encryptStream, decryptStream);
//         objectStorageWithMiddlewares.use(zip, unzip);
//         const objectStorageWithMiddlewaresCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .post('/objects')
//           .reply(200, { objectId: '1' });

//         const response: any = await objectStorageWithMiddlewares.postObject(postData, {});

//         expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
//         expect(response.objectId).to.be.equal('1');
//       });

//       it('should add 2 objects successfully', async () => {
//         const objectStorageWithMiddlewares = new ObjectStorage(config);
//         objectStorageWithMiddlewares.use(encryptStream, decryptStream);
//         objectStorageWithMiddlewares.use(zip, unzip);
//         const objectStorageWithMiddlewaresCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .post('/objects')
//           .reply(200, { objectId: '1' })
//           .post('/objects')
//           .reply(200, { objectId: '2' });

//         const response1: any = await objectStorageWithMiddlewares.postObject(postData, {});
//         const response2: any = await objectStorageWithMiddlewares.postObject(postData, {});
//         expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
//         expect(response1.objectId).to.be.equal('1');
//         expect(response2.objectId).to.be.equal('2');
//       });

//       it('should get 2 objects successfully', async () => {
//         const objectStorageWithMiddlewares = new ObjectStorage(config);
//         objectStorageWithMiddlewares.use(encryptStream, decryptStream);
//         objectStorageWithMiddlewares.use(zip, unzip);

//         const objectStorageWithMiddlewaresCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .get('/objects/1')
//           .reply(200, () => {
//             const stream = streamResponse(responseData)();
//             return stream.pipe(encryptStream()).pipe(zip());
//           })
//           .get('/objects/2')
//           .reply(200, () => {
//             const stream = streamResponse(responseData)();
//             return stream.pipe(encryptStream()).pipe(zip());
//           });

//         const outStreamFirst = await objectStorageWithMiddlewares.getById('1');
//         const outStreamSecond = await objectStorageWithMiddlewares.getById('2');
//         expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
//         expect(outStreamFirst).to.be.deep.equal(responseString);
//         expect(outStreamSecond).to.be.deep.equal(responseString);
//       });

//       it('should use valid jwt token', async () => {
//         const objectStorageWithMiddlewares = new ObjectStorage(config);
//         objectStorageWithMiddlewares.use(encryptStream, decryptStream);
//         objectStorageWithMiddlewares.use(zip, unzip);
//         const objectStorageWithMiddlewaresCalls = nock(config.uri)
//           // @ts-ignore: Nock .d.ts are outdated.
//           .matchHeader('authorization', `Bearer ${config.jwtSecret}`)
//           .post('/objects')
//           .reply(200);

//         const response: any = await objectStorageWithMiddlewares.postObject(postData, {});

//         expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
//         expect(response.objectId).to.match(/^[0-9a-z-]+$/);
//       });
//     });
//   });
// });
