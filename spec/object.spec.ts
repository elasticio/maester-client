import nock from 'nock';
import { createHash, randomBytes } from 'crypto';
import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import { Readable } from 'stream';
import FormData from 'form-data';

import { baseUri, randomObjectId, getClient, getToken, matchFormData } from './utils';
import { metaToHeaders } from '../src';

describe('objects', function () {
    interface RandomCreateObjectParams {
        contentType?: string;
        metadata?: Record<string, string>;
        bucket?: string;
    }

    function randomCreateObjectResponse(data: string | Buffer, params?: RandomCreateObjectParams) {
        const { contentType, metadata } = params ?? {};
        return {
            objectId: randomObjectId(),
            contentType: contentType ?? 'application/octet-stream',
            contentLength: data.length,
            md5: createHash('md5').update(data).digest().toString('hex'),
            createdAt: new Date().toISOString(),
            metadata: metadata ?? {}
        };
    }

    function transformResponse(response: any) {
        const res = {
            ...response,
            id: response.objectId,
            createdAt: new Date(response.createdAt)
        };
        delete res.objectId;
        return res;
    }

    before(function () {
        this.client = getClient();
        this.authorization = {
            reqheaders: {
                authorization: `Bearer ${getToken()}`
            }
        };
    });

    describe('get object', function () {
        it('should get object as text', async function () {
            const id = randomObjectId();
            const data = 'test123';
            const contentType = 'text/plain';
            const contentLength = data.length;
            const metadata = {
                field1: 'test',
                'field-2': '123'
            };

            const scope = nock(baseUri, this.options)
                .defaultReplyHeaders({
                    'content-type': contentType,
                    'content-length': contentLength.toString(),
                    ...metaToHeaders(metadata)
                })
                .get(`/objects/${id}`)
                .reply(200, data);

            const response = await this.client.objects.get(id);

            expect(scope.isDone()).to.be.true;
            expect(response.contentType).to.equal(contentType);
            expect(response.contentLength).to.equal(contentLength);
            expect(response.metadata).to.deep.equal(metadata);
            expect(response.data).to.equal(data);
        });

        it('should get object as JSON', async function () {
            const id = randomObjectId();
            const data = {
                key: 'value'
            };
            const contentType = 'application/json';
            const contentLength = JSON.stringify(data).length;
            const metadata = {
                field1: 'test',
                'field-2': '123'
            };

            const scope = nock(baseUri, this.options)
                .defaultReplyHeaders({
                    'content-type': contentType,
                    'content-length': contentLength.toString(),
                    ...metaToHeaders(metadata)
                })
                .get(`/objects/${id}`)
                .reply(200, data);

            const response = await this.client.objects.get(id);

            expect(scope.isDone()).to.be.true;
            expect(response.contentType).to.equal(contentType);
            expect(response.contentLength).to.equal(contentLength);
            expect(response.metadata).to.deep.equal(metadata);
            expect(response.data).to.deep.equal(data);
        });

        it('should get object as stream', async function () {
            const id = randomObjectId();
            const data = randomBytes(1024);
            const contentType = 'application/octet-stream';
            const contentLength = data.length;
            const metadata = {
                field1: 'test',
                'field-2': '123'
            };

            const scope = nock(baseUri, this.options)
                .defaultReplyHeaders({
                    'content-type': contentType,
                    'content-length': contentLength.toString(),
                    ...metaToHeaders(metadata)
                })
                .get(`/objects/${id}`)
                .reply(200, data);

            const response = await this.client.objects.get(id, 'stream');

            expect(scope.isDone()).to.be.true;
            expect(response.contentType).to.equal(contentType);
            expect(response.contentLength).to.equal(contentLength);
            expect(response.metadata).to.deep.equal(metadata);

            const buffer: Buffer = await new Promise((resolve, reject) => {
                const chunks: Buffer[] = [];
                response.data.on('data', (chunk: Buffer) => chunks.push(chunk));
                response.data.on('error', reject);
                response.data.on('end', () => resolve(Buffer.concat(chunks)))
            });

            expect(buffer.toString()).to.equal(data.toString());
        });
    });

    describe('create object', function () {
        describe('ordinary', function () {
            it('should create object from text', async function () {
                const data = 'test123';
                const response = randomCreateObjectResponse(data);

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', response.contentType)
                    .matchHeader('content-length', response.contentLength.toString())
                    .post('/objects', data)
                    .reply(201, response);

                const object = await this.client.objects.create(data);

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });

            it('should create object with metadata', async function () {
                const data = 'test123';
                const response = randomCreateObjectResponse(data, {
                    metadata: {
                        field1: 'test',
                        'field-2': '123'
                    }
                });

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', response.contentType)
                    .matchHeader('content-length', response.contentLength.toString())
                    .matchHeader('x-meta-field1', response.metadata.field1)
                    .matchHeader('x-meta-field-2', response.metadata['field-2'])
                    .post('/objects', data)
                    .reply(201, response);

                const object = await this.client.objects.create(data, {
                    metadata: response.metadata
                });

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });

            it('should create object and attach it bucket', async function () {
                const data = 'test123';
                const bucket = randomObjectId();
                const response = randomCreateObjectResponse(data);

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', response.contentType)
                    .matchHeader('content-length', response.contentLength.toString())
                    .matchHeader('x-meta-bucket', bucket)
                    .post('/objects', data)
                    .reply(201, response);

                const object = await this.client.objects.create(data, { bucket });

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });

            it('should create object and override content type', async function () {
                const data = 'test123';
                const response = randomCreateObjectResponse(data, { contentType: 'text/plain' });

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', response.contentType)
                    .matchHeader('content-length', response.contentLength.toString())
                    .post('/objects', data)
                    .reply(201, response);

                const object = await this.client.objects.create(data, {
                    contentType: response.contentType
                });

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });

            it('should create object from buffer', async function () {
                const data = randomBytes(1024);
                const response = randomCreateObjectResponse(data);

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', response.contentType)
                    .matchHeader('content-length', response.contentLength.toString())
                    .post('/objects', data)
                    .reply(201, response);

                const object = await this.client.objects.create(data);

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });

            it('should create object from stream', async function () {
                const data = randomBytes(1024);
                const stream = Readable.from([data]);
                const response = randomCreateObjectResponse(data);

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', response.contentType)
                    .post('/objects', data)
                    .reply(201, response);

                const object = await this.client.objects.create(stream);

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });
        });

        describe('multipart/form-data', function () {
            it('should create object from text', async function () {
                const data = 'test123';
                const response = randomCreateObjectResponse(data);

                const formData = new FormData();
                formData.append('data', data);

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', `multipart/form-data; boundary=${formData.getBoundary()}`)
                    .post('/objects', body =>
                        matchFormData(body, 'data', data))
                    .reply(201, response);

                const object = await this.client.objects.create(formData);

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });

            it('should create object with metadata', async function () {
                const data = 'test123';
                const response = randomCreateObjectResponse(data, {
                    metadata: {
                        field1: 'test',
                        'field-2': '123'
                    }
                });

                const formData = new FormData();
                formData.append('data', data);

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', `multipart/form-data; boundary=${formData.getBoundary()}`)
                    .matchHeader('x-meta-field1', response.metadata.field1)
                    .matchHeader('x-meta-field-2', response.metadata['field-2'])
                    .post('/objects', body =>
                        matchFormData(body, 'data', data))
                    .reply(201, response);

                const object = await this.client.objects.create(formData, {
                    metadata: response.metadata
                });

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });

            it('should create object and attach it bucket', async function () {
                const data = 'test123';
                const bucket = randomObjectId();
                const response = randomCreateObjectResponse(data);

                const formData = new FormData();
                formData.append('data', data);

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', `multipart/form-data; boundary=${formData.getBoundary()}`)
                    .post('/objects', body =>
                        matchFormData(body, 'data', data))
                    .reply(201, response);

                const object = await this.client.objects.create(formData, { bucket });

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });

            it('should create object and override content type', async function () {
                const data = 'test123';
                const response = randomCreateObjectResponse(data, { contentType: 'text/plain' });

                const formData = new FormData();
                formData.append('data', data, { contentType: response.contentType });

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', `multipart/form-data; boundary=${formData.getBoundary()}`)
                    .post('/objects', body =>
                        matchFormData(body, 'data', data, response.contentType))
                    .reply(201, response);

                const object = await this.client.objects.create(formData);

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });

            it('should create object from buffer', async function () {
                const data = randomBytes(1024);
                const response = randomCreateObjectResponse(data);

                const formData = new FormData();
                formData.append('data', data);

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', `multipart/form-data; boundary=${formData.getBoundary()}`)
                    .post('/objects', body =>
                        matchFormData(body, 'data', data, 'application/octet-stream'))
                    .reply(201, response);

                const object = await this.client.objects.create(formData);

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });

            it('should create object from stream', async function () {
                const data = randomBytes(1024);
                const stream = Readable.from([data]);
                const response = randomCreateObjectResponse(data);

                const formData = new FormData();
                formData.append('data', stream);

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', `multipart/form-data; boundary=${formData.getBoundary()}`)
                    .post('/objects', body =>
                        matchFormData(body, 'data', data, 'application/octet-stream'))
                    .reply(201, response);

                const object = await this.client.objects.create(formData);

                expect(scope.isDone()).to.be.true;
                expect(object).to.deep.equal(transformResponse(response));
            });

            it('should create multiple objects', async function () {
                const data1 = 'test123';
                const data2 = randomBytes(1024);
                const data3 = randomBytes(1024);
                const stream = Readable.from([data3]);
                const response = [
                    randomCreateObjectResponse(data1),
                    randomCreateObjectResponse(data2),
                    randomCreateObjectResponse(data3)
                ];

                const formData = new FormData();
                formData.append('data', data1);
                formData.append('data', data2);
                formData.append('data', stream);

                const scope = nock(baseUri, this.options)
                    .matchHeader('content-type', `multipart/form-data; boundary=${formData.getBoundary()}`)
                    .post('/objects', body =>
                        matchFormData(body, 'data', data1) &&
                        matchFormData(body, 'data', data2, 'application/octet-stream') &&
                        matchFormData(body, 'data', data3, 'application/octet-stream')
                    )
                    .reply(201, response);

                const objects = await this.client.objects.create(formData);

                expect(scope.isDone()).to.be.true;
                expect(objects).to.deep.equal(response.map(transformResponse));
            });
        });
    });

    it('should delete objects', async function () {
        const id = randomObjectId();

        const scope = nock(baseUri, this.options)
            .delete(`/objects/${id}`)
            .reply(204);

        await this.client.objects.delete(id);

        expect(scope.isDone()).to.be.true;
    });
});
