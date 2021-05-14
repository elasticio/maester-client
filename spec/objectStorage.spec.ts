import nock from 'nock';
import sinonjs, { SinonSandbox } from 'sinon';
import { expect } from 'chai';
import logging from '../src/logger';
import { describe, beforeEach, afterEach, it } from 'mocha';
import ObjectStorage from '../src/objectStorage';
import { Readable } from 'stream';
import { verify, sign } from 'jsonwebtoken';
import { streamResponse, encryptStream, decryptStream, zip, unzip } from './helpers';

xdescribe('Object Storage', () => {
    const config = {
        uri: 'https://ma.es.ter',
        jwtSecret: 'jwt'
    };

    const postData = { test: 'test' };

    const responseData = {
        contentLength: 'meta.contentLength',
        contentType: 'meta.contentType',
        createdAt: 'meta.createdAt',
        md5: 'meta.md5Hash',
        objectId: 'obj.id',
        metadata: 'meta.userMetadata'
    };

    let postStream: Readable;
    let sinon: SinonSandbox;
    beforeEach(async () => {
        sinon = sinonjs.createSandbox();

        postStream = new Readable();
        postStream.push(JSON.stringify(postData));
        postStream.push(null);
    });
    afterEach(() => {
        sinon.restore();
    });

    function authHeaderMatch(jwtPayload?: { [index: string]: string }) {
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
                    await objectStorage.getById('1', {});
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

                const response = await objectStorage.getById('1', {});

                expect(objectStorageCalls.isDone()).to.be.true;
                expect(response).to.be.deep.equal(responseData);
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
        // describe('data mode', () => {});

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
                    await objectStorageWithMiddlewares.getById('1', {});
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

                const response = await objectStorageWithMiddlewares.getById('1', {});

                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(response).to.be.deep.equal(responseData);
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

                const objectIdFirst = await objectStorageWithMiddlewares.addAsStream(postStream, {}, sign(jwtPayload, config.jwtSecret));
                const objectIdSecond = await objectStorageWithMiddlewares.addAsStream(postStream, {}, sign(jwtPayload, config.jwtSecret));
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

                const outStreamFirst = await objectStorageWithMiddlewares.getById('1', sign(jwtPayload, config.jwtSecret));
                const outStreamSecond = await objectStorageWithMiddlewares.getById('2', sign(jwtPayload, config.jwtSecret));
                expect(objectStorageWithMiddlewaresCalls.isDone()).to.be.true;
                expect(outStreamFirst).to.be.deep.equal(responseData);
                expect(outStreamSecond).to.be.deep.equal(responseData);
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
});
