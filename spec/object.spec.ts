import nock from 'nock';
import { createHash, randomBytes } from 'crypto';
import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import { Readable } from 'stream';

import { randomObjectId, matchFormData } from './utils';
import { Client, metaToHeaders } from '../src';

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
        this.client = new Client('http://127.0.0.1', 'token');
        this.authorization = {
            reqheaders: {
                authorization: `Bearer ${this.client.token as string}`
            }
        };
    });

    describe('get object', function () {
        it('should get object', async function () {
            const id = randomObjectId();
            const data = 'test123';
            const contentType = 'text/plain';
            const contentLength = data.length;

            const scope = nock(this.client.baseUri, this.options)
                .defaultReplyHeaders({
                    'content-type': contentType,
                    'content-length': contentLength.toString()
                })
                .get(`/objects/${id}`)
                .reply(200, data);

            const response = await this.client.objects.get(id);

            expect(scope.isDone()).to.be.true;
            expect(response.contentType).to.equal(contentType);
            expect(response.contentLength).to.equal(contentLength);
            expect(response.metadata).to.deep.equal({});
            expect(response.data).to.equal(data);
        });

        it('should get object with metadata', async function () {
            const id = randomObjectId();
            const data = 'test123';
            const contentType = 'text/plain';
            const contentLength = data.length;
            const metadata = {
                field1: 'test',
                'field-2': '123'
            };

            const scope = nock(this.client.baseUri, this.options)
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

            const scope = nock(this.client.baseUri, this.options)
                .defaultReplyHeaders({
                    'content-type': contentType,
                    'content-length': contentLength.toString()
                })
                .get(`/objects/${id}`)
                .reply(200, data);

            const response = await this.client.objects.getJSON(id);

            expect(scope.isDone()).to.be.true;
            expect(response.contentType).to.equal(contentType);
            expect(response.contentLength).to.equal(contentLength);
            expect(response.metadata).to.deep.equal({});
            expect(response.data).to.deep.equal(data);
        });

        it('should get object as buffer', async function () {
            const id = randomObjectId();
            const data = 'test123';
            const contentType = 'application/octet-stream';
            const contentLength = data.length;

            const scope = nock(this.client.baseUri, this.options)
                .defaultReplyHeaders({
                    'content-type': contentType,
                    'content-length': contentLength.toString()
                })
                .get(`/objects/${id}`)
                .reply(200, data);

            const response = await this.client.objects.getBuffer(id);

            expect(scope.isDone()).to.be.true;
            expect(response.contentType).to.equal(contentType);
            expect(response.contentLength).to.equal(contentLength);
            expect(response.metadata).to.deep.equal({});
            expect(response.data.toString()).to.equal(data);
        });

        it('should get object as stream', async function () {
            const id = randomObjectId();
            const data = randomBytes(1024);
            const contentType = 'application/octet-stream';
            const contentLength = data.length;

            const scope = nock(this.client.baseUri, this.options)
                .defaultReplyHeaders({
                    'content-type': contentType,
                    'content-length': contentLength.toString()
                })
                .get(`/objects/${id}`)
                .reply(200, data);

            const response = await this.client.objects.getStream(id);

            expect(scope.isDone()).to.be.true;
            expect(response.contentType).to.equal(contentType);
            expect(response.contentLength).to.equal(contentLength);
            expect(response.metadata).to.deep.equal({});

            const buffer: Buffer = await new Promise((resolve, reject) => {
                const chunks: Buffer[] = [];
                response.data.on('data', (chunk: Buffer) => chunks.push(chunk));
                response.data.on('error', reject);
                response.data.on('end', () => resolve(Buffer.concat(chunks)))
            });

            expect(buffer.toString()).to.equal(data.toString());
        });

        it('should get read stream', async function () {
            const id = randomObjectId();
            const data = randomBytes(1024);
            const contentType = 'application/octet-stream';
            const contentLength = data.length;

            const scope = nock(this.client.baseUri, this.options)
                .defaultReplyHeaders({
                    'content-type': contentType,
                    'content-length': contentLength.toString()
                })
                .get(`/objects/${id}`)
                .reply(200, data);

            const stream = await this.client.objects.getReadStream(id);

            expect(scope.isDone()).to.be.true;

            const buffer: Buffer = await new Promise((resolve, reject) => {
                const chunks: Buffer[] = [];
                stream.on('data', (chunk: Buffer) => chunks.push(chunk));
                stream.on('error', reject);
                stream.on('end', () => resolve(Buffer.concat(chunks)))
            });

            expect(buffer.toString()).to.equal(data.toString());
        });
    });

    describe('create object', function () {
        it('should create object from text', async function () {
            const data = 'test123';
            const response = randomCreateObjectResponse(data);

            const scope = nock(this.client.baseUri, this.options)
                .matchHeader('content-type', /multipart\/form-data/)
                .post('/objects', body =>
                    matchFormData(body, 'data', data, response.contentType))
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

            const scope = nock(this.client.baseUri, this.options)
                .matchHeader('content-type', /multipart\/form-data/)
                .post('/objects', body =>
                    matchFormData(body, 'data', data, response.contentType) &&
                    matchFormData(body, 'field1', response.metadata.field1) &&
                    matchFormData(body, 'field-2', response.metadata['field-2']))
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

            const scope = nock(this.client.baseUri, this.options)
                .matchHeader('content-type', /multipart\/form-data/)
                .post('/objects', body =>
                    matchFormData(body, 'data', data, response.contentType) &&
                    matchFormData(body, 'bucket', bucket))
                .reply(201, response);

            const object = await this.client.objects.create(data, { bucket });

            expect(scope.isDone()).to.be.true;
            expect(object).to.deep.equal(transformResponse(response));
        });

        it('should create object and override content type', async function () {
            const data = 'test123';
            const response = randomCreateObjectResponse(data, { contentType: 'text/plain' });

            const scope = nock(this.client.baseUri, this.options)
                .matchHeader('content-type', /multipart\/form-data/)
                .post('/objects', body =>
                    matchFormData(body, 'data', data, response.contentType))
                .reply(201, response);

            const object = await this.client.objects.create({
                data,
                contentType: response.contentType
            });

            expect(scope.isDone()).to.be.true;
            expect(object).to.deep.equal(transformResponse(response));
        });

        it('should create object from buffer', async function () {
            const data = randomBytes(1024);
            const response = randomCreateObjectResponse(data);

            const scope = nock(this.client.baseUri, this.options)
                .matchHeader('content-type', /multipart\/form-data/)
                .post('/objects', body =>
                    matchFormData(body, 'data', data, response.contentType))
                .reply(201, response);

            const object = await this.client.objects.create(data);

            expect(scope.isDone()).to.be.true;
            expect(object).to.deep.equal(transformResponse(response));
        });

        it('should create object from stream', async function () {
            const data = randomBytes(1024);
            const stream = Readable.from([data]);
            const response = randomCreateObjectResponse(data);

            const scope = nock(this.client.baseUri, this.options)
                .matchHeader('content-type', /multipart\/form-data/)
                .post('/objects', body =>
                    matchFormData(body, 'data', data, response.contentType))
                .reply(201, response);

            const object = await this.client.objects.create(stream);

            expect(scope.isDone()).to.be.true;
            expect(object).to.deep.equal(transformResponse(response));
        });

        it('should create multiple objects', async function () {
            const data1 = 'test123';
            const data2 = randomBytes(1024);
            const data3 = randomBytes(1024);
            const stream = Readable.from([data3]);
            const response = [
                randomCreateObjectResponse(data1, { contentType: 'text/plain' }),
                randomCreateObjectResponse(data2),
                randomCreateObjectResponse(data3)
            ];

            const data = [
                {
                    data: data1,
                    contentType: response[0].contentType
                },
                data2,
                stream
            ];

            const scope = nock(this.client.baseUri, this.options)
                .matchHeader('content-type', /multipart\/form-data/)
                .post('/objects', body =>
                    matchFormData(body, 'data', data1, response[0].contentType) &&
                    matchFormData(body, 'data', data2, response[1].contentType) &&
                    matchFormData(body, 'data', data3, response[2].contentType)
                )
                .reply(201, response);

            const objects = await this.client.objects.create(data);

            expect(scope.isDone()).to.be.true;
            expect(objects).to.deep.equal(response.map(transformResponse));
        });

        it('should create write stream', async function () {
            const data = randomBytes(1024);
            const stream = Readable.from([data]);

            const scope = nock(this.client.baseUri, this.options)
                .matchHeader('content-type', /multipart\/form-data/)
                .post('/objects', body =>
                    matchFormData(body, 'data', data, 'application/octet-stream'))
                .reply(201);

            const writeable = stream.pipe(this.client.objects.createWriteStream());

            await new Promise((resolve, reject) => {
                writeable.on('error', reject);
                writeable.on('finish', resolve);
            });

            expect(scope.isDone()).to.be.true;
        });
    });

    it('should delete objects', async function () {
        const id = randomObjectId();

        const scope = nock(this.client.baseUri, this.options)
            .delete(`/objects/${id}`)
            .reply(204);

        await this.client.objects.delete(id);

        expect(scope.isDone()).to.be.true;
    });
});
