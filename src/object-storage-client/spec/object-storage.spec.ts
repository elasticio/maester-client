import nock from 'nock';
import sinonjs, { SinonSandbox } from 'sinon';
import { expect } from 'chai';
import getStream from 'get-stream';
import logging from '../src/logger';
import { describe, beforeEach, afterEach, it } from 'mocha';
import ObjectStorage from '../src/object-storage';
import { Readable } from 'stream';
import { verify, sign } from 'jsonwebtoken';
import { streamResponse, encryptStream, decryptStream, zip, unzip } from './helpers';

describe('Object Storage', () => {
    const config = {
        uri: 'https://ma.es.ter',
        jwtSecret: 'jwt'
    };

    const postData = { test: 'test' };
    const batch = { foo: 'bar', status: 'OPEN' }

    const responseData = {
        contentLength: 'meta.contentLength',
        contentType: 'meta.contentType',
        createdAt: 'meta.createdAt',
        md5: 'meta.md5Hash',
        objectId: 'obj.id',
        metadata: 'meta.userMetadata'
    };

    let postStream: () => Readable;

    let sinon: SinonSandbox;
    beforeEach(async () => {
        sinon = sinonjs.createSandbox();

        postStream = () => {
            const stream = new Readable();
            stream.push(JSON.stringify(postData));
            stream.push(null);
            return stream;
        };
    });
    afterEach(() => {
        sinon.restore();
    });

    function authHeaderMatch (jwtPayload?: { [index: string]: string }) {
        return (val: string) => {
            const decoded = verify(val.split(' ')[1], config.jwtSecret);
            if (jwtPayload) {
                expect(decoded).to.deep.include(jwtPayload);
            }
            return decoded;
        };
    }

    describe('basic', () => {
        describe('data mode', () => {
            it('should fail after 3 retries', async () => {
                const log = sinon.stub(logging, 'warn');
                const objectStorage = new ObjectStorage(config);

                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects/1')
                    .replyWithError({ code: 'ETIMEDOUT' })
                    .get('/objects/1')
                    .reply(404)
                    .get('/objects/1')
                    .replyWithError({ code: 'ENOTFOUND' });

                let err;
                try {
                    await objectStorage.getAsJSON('1', {});
                } catch (e) {
                    err = e;
                }

                expect(objectStorageCalls.isDone()).to.be.true;
                expect(err.code).to.be.equal('ENOTFOUND');
                expect(log.getCall(1).args[1].toString()).to.include('404');
                expect(log.callCount).to.be.equal(2);
            });

            it('should retry get request 3 times on errors', async () => {
                const objectStorage = new ObjectStorage(config);

                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects/1')
                    .reply(500)
                    .get('/objects/1')
                    .replyWithError({ code: 'ECONNRESET' })
                    .get('/objects/1')
                    .reply(200, streamResponse(responseData));

                const out = await objectStorage.getAsJSON('1', {});

                expect(objectStorageCalls.isDone()).to.be.true;
                expect(out).to.be.deep.equal(responseData);
            });

            it('should retry post request 3 times on errors', async () => {
                const objectStorage = new ObjectStorage(config);

                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .post('/objects')
                    .replyWithError({ code: 'ECONNREFUSED' })
                    .post('/objects')
                    .reply(400)
                    .post('/objects')
                    .reply(200, responseData);

                await objectStorage.addAsJSON(postData, {});

                expect(objectStorageCalls.isDone()).to.be.true;
            });

            it('should accept jwt token on add', async () => {
                const objectStorage = new ObjectStorage({ uri: config.uri });

                const jwtPayload = { tenantId: '12', contractId: '1' };
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch(jwtPayload))
                    .post('/objects')
                    .reply(200);

                const objectId = await objectStorage.addAsJSON(postData, sign(jwtPayload, config.jwtSecret));

                expect(objectStorageCalls.isDone()).to.be.true;
                expect(objectId).to.match(/^[0-9a-z-]+$/);
            });

            it('should accept jwt token on get', async () => {
                const objectStorage = new ObjectStorage({ uri: config.uri });

                const jwtPayload = { tenantId: '12', contractId: '1' };
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch(jwtPayload))
                    .get('/objects/1')
                    .reply(200, streamResponse(responseData));

                const out = await objectStorage.getAsJSON('1', sign(jwtPayload, config.jwtSecret));

                expect(objectStorageCalls.isDone()).to.be.true;
                expect(out).to.be.deep.equal(responseData);
            });

            it('should accept jwt token on delete', async () => {
                const objectStorage = new ObjectStorage({ uri: config.uri });

                const jwtPayload = { tenantId: '12', contractId: '1' };
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch(jwtPayload))
                    .delete('/objects/1')
                    .reply(204);

                await objectStorage.deleteOne('1', sign(jwtPayload, config.jwtSecret));

                expect(objectStorageCalls.isDone()).to.be.true;
            });

            it('should throw exception if neither jwt secret, nor jwt token provided', async () => {
                const objectStorage = new ObjectStorage({ uri: config.uri });

                let err;
                try {
                    await objectStorage.getAsJSON('1', {});
                } catch (e) {
                    err = e;
                }

                expect(err.toString()).to.include('JWT');
            });
        });

        describe('stream mode', () => {
            it('should fail after 3 get retries', async () => {
                const log = sinon.stub(logging, 'warn');
                const objectStorage = new ObjectStorage(config);

                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects/1')
                    .replyWithError({ code: 'ETIMEDOUT' })
                    .get('/objects/1')
                    .reply(404)
                    .get('/objects/1')
                    .replyWithError({ code: 'ENOTFOUND' });

                let err;
                try {
                    await objectStorage.getAsStream('1', {});
                } catch (e) {
                    err = e;
                }

                expect(objectStorageCalls.isDone()).to.be.true;
                expect(err.code).to.be.equal('ENOTFOUND');
                expect(log.getCall(1).args[1].toString()).to.include('404');
                expect(log.callCount).to.be.equal(2);
            });

            it('should retry get request on errors', async () => {
                const objectStorage = new ObjectStorage(config);

                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects/1')
                    .reply(500)
                    .get('/objects/1')
                    .reply(200, streamResponse(responseData));

                const response = await objectStorage.getAsStream('1', {});

                const out = JSON.parse(await getStream(response.stream));

                expect(objectStorageCalls.isDone()).to.be.true;
                expect(out).to.be.deep.equal(responseData);
            });

            it('should throw an error on put request connection error', async () => {
                const objectStorage = new ObjectStorage(config);

                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .post('/objects')
                    .replyWithError({ code: 'ECONNREFUSED' })
                    .post('/objects')
                    .replyWithError({ code: 'ECONNREFUSED' })
                    .post('/objects')
                    .replyWithError({ code: 'ECONNREFUSED' });

                let err;
                try {
                    await objectStorage.addAsStream(postStream, {});
                } catch (e) {
                    err = e;
                }

                expect(objectStorageCalls.isDone()).to.be.true;
                expect(err.code).to.be.equal('ECONNREFUSED');
            });

            it('should throw an error on put request http error', async () => {
                const objectStorage = new ObjectStorage(config);

                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .post('/objects')
                    .reply(409)
                    .post('/objects')
                    .reply(409)
                    .post('/objects')
                    .reply(409);

                let err;
                try {
                    await objectStorage.addAsStream(postStream, {});
                } catch (e) {
                    err = e;
                }
                expect(objectStorageCalls.isDone()).to.be.true;
                expect(err.toString()).to.include('409');
            });

            it('should put successfully', async () => {
                const objectStorage = new ObjectStorage(config);

                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .post('/objects')
                    .reply(200);

                const objectId = await objectStorage.addAsStream(postStream, {});

                expect(objectStorageCalls.isDone()).to.be.true;
                expect(objectId).to.match(/^[0-9a-z-]+$/);
            });

            it('should use valid jwt token', async () => {
                const objectStorage = new ObjectStorage(config);

                const jwtPayload = { tenantId: '12', contractId: '1' };
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch(jwtPayload))
                    .post('/objects')
                    .reply(200);

                const objectId = await objectStorage.addAsStream(postStream, jwtPayload);

                expect(objectStorageCalls.isDone()).to.be.true;
                expect(objectId).to.match(/^[0-9a-z-]+$/);
            });
        });
    });

    describe('middlewares + zip/unzip and encrypt/decrypt', () => {
        describe('data mode', () => {
            it('should fail after 3 retries', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const log = sinon.stub(logging, 'warn');
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects/1')
                    .replyWithError({ code: 'ETIMEDOUT' })
                    .get('/objects/1')
                    .reply(404)
                    .get('/objects/1')
                    .replyWithError({ code: 'ENOTFOUND' });

                let err;
                try {
                    await objectStorageWithMiddlewares.getAsJSON('1', {});
                } catch (e) {
                    err = e;
                }

                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(err.code).to.be.equal('ENOTFOUND');
                expect(log.getCall(1).args[1].toString()).to.include('404');
                expect(log.callCount).to.be.equal(2);
            });

            it('should retry get request 3 times on errors', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects/1')
                    .reply(500)
                    .get('/objects/1')
                    .replyWithError({ code: 'ECONNRESET' })
                    .get('/objects/1')
                    .reply(200, () => {
                        const stream = streamResponse(responseData)();
                        return stream.pipe(encryptStream()).pipe(zip());
                    });

                const out = await objectStorageWithMiddlewares.getAsJSON('1', {});

                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(out).to.be.deep.equal(responseData);
            });

            it('should retry post request 3 times on errors', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .post('/objects')
                    .replyWithError({ code: 'ECONNREFUSED' })
                    .post('/objects')
                    .reply(400)
                    .post('/objects')
                    .reply(200, responseData);

                await objectStorageWithMiddlewares.addAsJSON(postData, {});

                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
            });

            it('should accept jwt token on add', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const jwtPayload = { tenantId: '12', contractId: '1' };
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch(jwtPayload))
                    .post('/objects')
                    .reply(200);

                const objectId = await objectStorageWithMiddlewares.addAsJSON(postData, sign(jwtPayload, config.jwtSecret));

                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(objectId).to.match(/^[0-9a-z-]+$/);
            });

            it('should accept jwt token on get', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);

                const jwtPayload = { tenantId: '12', contractId: '1' };
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch(jwtPayload))
                    .get('/objects/1')
                    .reply(200, () => {
                        const stream = streamResponse(responseData)();
                        return stream.pipe(encryptStream()).pipe(zip());
                    });

                const out = await objectStorageWithMiddlewares.getAsJSON('1', sign(jwtPayload, config.jwtSecret));

                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(out).to.be.deep.equal(responseData);
            });

            it('should add 2 objects successfully', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const jwtPayload = { tenantId: '12', contractId: '1' };
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch(jwtPayload))
                    .post('/objects')
                    .reply(200, { objectId: '1' })
                    .post('/objects')
                    .reply(200, { objectId: '2' });

                const objectIdFirst = await objectStorageWithMiddlewares.addAsJSON(postData, sign(jwtPayload, config.jwtSecret));
                const objectIdSecond = await objectStorageWithMiddlewares.addAsJSON(postData, sign(jwtPayload, config.jwtSecret));
                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(objectIdFirst).to.be.equal('1');
                expect(objectIdSecond).to.be.equal('2');
            });

            it('should get 2 objects successfully', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);

                const jwtPayload = { tenantId: '12', contractId: '1' };
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch(jwtPayload))
                    .get('/objects/1')
                    .reply(200, () => {
                        const stream = streamResponse(responseData)();
                        return stream.pipe(encryptStream()).pipe(zip());
                    })
                    .get('/objects/2')
                    .reply(200, () => {
                        const stream = streamResponse(responseData)();
                        return stream.pipe(encryptStream()).pipe(zip());
                    });

                const outFirst = await objectStorageWithMiddlewares.getAsJSON('1', sign(jwtPayload, config.jwtSecret));
                const outSecond = await objectStorageWithMiddlewares.getAsJSON('2', sign(jwtPayload, config.jwtSecret));

                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(outFirst).to.be.deep.equal(responseData);
                expect(outSecond).to.be.deep.equal(responseData);
            });

            it('should throw exception if neither jwt secret, nor jwt token provided', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage({ uri: config.uri });

                let err;
                try {
                    await objectStorageWithMiddlewares.getAsJSON('1', {});
                } catch (e) {
                    err = e;
                }

                expect(err.toString()).to.include('JWT');
            });
        });

        describe('stream mode', () => {
            it('should fail after 3 get retries', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const log = sinon.stub(logging, 'warn');
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects/1')
                    .replyWithError({ code: 'ETIMEDOUT' })
                    .get('/objects/1')
                    .reply(404)
                    .get('/objects/1')
                    .replyWithError({ code: 'ENOTFOUND' });

                let err;
                try {
                    await objectStorageWithMiddlewares.getAsStream('1', {});
                } catch (e) {
                    err = e;
                }

                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(err.code).to.be.equal('ENOTFOUND');
                expect(log.getCall(1).args[1].toString()).to.include('404');
                expect(log.callCount).to.be.equal(2);
            });

            it('should retry get request on errors', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects/1')
                    .reply(500)
                    .get('/objects/1')
                    .reply(200, () => {
                        const stream = streamResponse(responseData)();
                        return stream.pipe(encryptStream()).pipe(zip());
                    });

                const response = await objectStorageWithMiddlewares.getAsStream('1', {});

                const out = JSON.parse(await getStream(response.stream));
                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(out).to.be.deep.equal(responseData);
            });

            it('should throw an error on put request connection error', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .post('/objects')
                    .replyWithError({ code: 'ECONNREFUSED' })
                    .post('/objects')
                    .replyWithError({ code: 'ECONNREFUSED' })
                    .post('/objects')
                    .replyWithError({ code: 'ECONNREFUSED' });

                let err;
                try {
                    await objectStorageWithMiddlewares.addAsStream(postStream, {});
                } catch (e) {
                    err = e;
                }

                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(err.code).to.be.equal('ECONNREFUSED');
            });

            it('should throw an error on put request http error', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .post('/objects')
                    .reply(409)
                    .post('/objects')
                    .reply(409)
                    .post('/objects')
                    .reply(409);

                let err;
                try {
                    await objectStorageWithMiddlewares.addAsStream(postStream, {});
                } catch (e) {
                    err = e;
                }
                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(err.toString()).to.include('409');
            });

            it('should post successfully', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .post('/objects')
                    .reply(200, { objectId: '1' });

                const objectId = await objectStorageWithMiddlewares.addAsStream(postStream, {});

                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(objectId).to.be.equal('1');
            });

            it('should add 2 objects successfully', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const jwtPayload = { tenantId: '12', contractId: '1' };
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch(jwtPayload))
                    .post('/objects')
                    .reply(200, { objectId: '1' })
                    .post('/objects')
                    .reply(200, { objectId: '2' });

                const objectIdFirst = await objectStorageWithMiddlewares.addAsStream(postStream, sign(jwtPayload, config.jwtSecret));
                const objectIdSecond = await objectStorageWithMiddlewares.addAsStream(postStream, sign(jwtPayload, config.jwtSecret));
                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(objectIdFirst).to.be.equal('1');
                expect(objectIdSecond).to.be.equal('2');
            });

            it('should get 2 objects successfully', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);

                const jwtPayload = { tenantId: '12', contractId: '1' };
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch(jwtPayload))
                    .get('/objects/1')
                    .reply(200, () => {
                        const stream = streamResponse(responseData)();
                        return stream.pipe(encryptStream()).pipe(zip());
                    })
                    .get('/objects/2')
                    .reply(200, () => {
                        const stream = streamResponse(responseData)();
                        return stream.pipe(encryptStream()).pipe(zip());
                    });

                const outStreamFirst = await objectStorageWithMiddlewares.getAsStream('1', sign(jwtPayload, config.jwtSecret));
                const outFirst = JSON.parse(await getStream(outStreamFirst.stream));
                const outStreamSecond = await objectStorageWithMiddlewares.getAsStream('2', sign(jwtPayload, config.jwtSecret));
                const outSecond = JSON.parse(await getStream(outStreamSecond.stream));
                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(outFirst).to.be.deep.equal(responseData);
                expect(outSecond).to.be.deep.equal(responseData);
            });

            it('should use valid jwt token', async () => {
                const objectStorageWithMiddlewares = new ObjectStorage(config);
                objectStorageWithMiddlewares.use(encryptStream, decryptStream);
                objectStorageWithMiddlewares.use(zip, unzip);
                const jwtPayload = { tenantId: '12', contractId: '1' };
                const objectStorageWithMiddlewaresCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch(jwtPayload))
                    .post('/objects')
                    .reply(200);

                const objectId = await objectStorageWithMiddlewares.addAsStream(postStream, jwtPayload);

                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(objectId).to.match(/^[0-9a-z-]+$/);
            });
        });
    });

    describe('batches api', () => {
        describe('create batches', () => {
            it('should create batch', async() => {
                const objectStorage = new ObjectStorage(config);
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .post('/objects')
                    .once()
                    .reply(200, { objectId: '1' });

                await objectStorage.createAllBatches([batch], {});

                expect(objectStorageCalls.isDone()).to.be.true;
            })

            it('should create multiple batches', async() => {
                const objectStorage = new ObjectStorage(config);
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .post('/objects')
                    .twice()
                    .reply(200, []);

                await objectStorage.createAllBatches([batch, batch], {});

                expect(objectStorageCalls.isDone()).to.be.true;
            })
        })

        describe('lookup batches', () => {
            it('should return all bataches in defined status', async() => {
                const objectStorage = new ObjectStorage(config);
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects?query[status]=OPEN')
                    .reply(200, []);

                await objectStorage.getAllBatachesInStatus('OPEN', {});
                expect(objectStorageCalls.isDone()).to.be.true;
            })

            it('should check if batch exists', async() => {
                const objectStorage = new ObjectStorage(config);
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects/fake_id')
                    .reply(200, {});

                await objectStorage.isBatchExist('fake_id', {});
                expect(objectStorageCalls.isDone()).to.be.true;
            })
        })

        describe('update batches', () => {
            it('should update batch', async() => {
                const objectStorage = new ObjectStorage(config);
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .put('/objects/fake_id')
                    .reply(200, {});

                await objectStorage.updateBatch('fake_id', {}, {});
                expect(objectStorageCalls.isDone()).to.be.true;
            })

            it('should update batch as stream', async() => {
                const objectStorage = new ObjectStorage(config);
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .put('/objects/fake_id')
                    .reply(200, {});

                await objectStorage.updateBatch('fake_id', postStream(), {});
                expect(objectStorageCalls.isDone()).to.be.true;
            })

            it('should update batch status by id', async() => {
                const objectStorage = new ObjectStorage(config);
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .put('/objects/fake_id')
                    .reply(200, {});

                await objectStorage.updateBatchStatusById('fake_id', 'SUCCESS', {});
                expect(objectStorageCalls.isDone()).to.be.true;
            })

            it('should lock all ready batches', async() => {
                const objectStorage = new ObjectStorage(config);
                const objectStorageGetCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects?query[status]=READY')
                    .once()
                    .reply(200, [
                        { id: 'fake_id', ...batch },
                        { id: 'fake_id', ...batch }
                    ]);
                const objectStorageUpdateCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .put('/objects/fake_id')
                    .twice()
                    .reply(200, {});

                await objectStorage.getAndLockBatches({});
                expect(objectStorageGetCalls.isDone()).to.be.true;
                expect(objectStorageUpdateCalls.isDone()).to.be.true;
            })
        })

        describe('delete batches', () => {
            it('should delete batch', async() => {
                const objectStorage = new ObjectStorage(config);
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .delete('/objects/fake_id')
                    .once()
                    .reply(200, {});

                await objectStorage.deleteAllBatches(['fake_id'], {});
                expect(objectStorageCalls.isDone()).to.be.true;
            })

            it('should delete all batches', async() => {
                const objectStorage = new ObjectStorage(config);
                const objectStorageCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .delete('/objects/fake_id')
                    .twice()
                    .reply(200, {});

                await objectStorage.deleteAllBatches(['fake_id', 'fake_id'], {});
                expect(objectStorageCalls.isDone()).to.be.true;
            })

            it('should delete all batches by status', async() => {
                const objectStorage = new ObjectStorage(config);
                const objectStorageGetCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .get('/objects?query[status]=READY')
                    .once()
                    .reply(200, [
                        { id: 'fake_id', ...batch },
                        { id: 'fake_id', ...batch }
                    ]);
                const objectStorageDeleteCalls = nock(config.uri)
                    // @ts-ignore: Nock .d.ts are outdated.
                    .matchHeader('authorization', authHeaderMatch())
                    .delete('/objects/fake_id')
                    .twice()
                    .reply(200, {});

                await objectStorage.deleteAllWithStatus('READY', {});
                expect(objectStorageGetCalls.isDone()).to.be.true;
                expect(objectStorageDeleteCalls.isDone()).to.be.true;
            })
        })
    })
});
