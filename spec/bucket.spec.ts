import nock from 'nock';
import { expect } from 'chai';
import { describe, it, before } from 'mocha';

import { baseUri, randomObjectId, getClient, getToken } from './utils';

describe('buckets', () => {
    function randomBucket() {
        return {
            id: randomObjectId(),
            objects: [randomObjectId(), randomObjectId(), randomObjectId()],
            externalId: randomObjectId(),
            closed: true,
            createdAt: new Date().toISOString()
        };
    }

    function transformResponse(response: any) {
        return {
            ...response,
            createdAt: new Date(response.createdAt)
        }
    }

    before(function () {
        this.client = getClient();
        this.options = {
            reqheaders: {
                authorization: `Bearer ${getToken()}`
            }
        };
    });

    it('should get bucket', async function () {
        const response = randomBucket();

        const scope = nock(baseUri, this.options)
            .get(`/buckets/${response.id}`)
            .reply(200, response);

        const bucket = await this.client.buckets.get(response.id);

        expect(scope.isDone()).to.be.true;
        expect(bucket).to.deep.equal(transformResponse(response));
    });

    it('should list buckets', async function () {
        const response = {
            data: [
                randomBucket()
            ],
            meta: {
                page: 1,
                perPage: 25,
                total: 1,
                totalPages: 1
            }
        };

        const params = {
            workspaceId: randomObjectId(),
            externalId: response.data[0].externalId,
            page: {
                number: response.meta.page,
                size: response.meta.perPage
            }
        };

        const scope = nock(baseUri, this.options)
            .get('/buckets')
            .query(params)
            .reply(200, response);

        const buckets = await this.client.buckets.list(params);

        expect(scope.isDone()).to.be.true;
        expect(buckets).to.deep.equal({
            data: [
                transformResponse(response.data[0])
            ],
            meta: {
                ...response.meta
            }
        });
    });

    it('should create bucket', async function () {
        const response = randomBucket();

        const scope = nock(baseUri, this.options)
            .post('/buckets')
            .reply(201, response);

        const bucket = await this.client.buckets.create({
            objects: response.objects,
            externalId: response.externalId
        });

        expect(scope.isDone()).to.be.true;
        expect(bucket).to.deep.equal(transformResponse(response));
    });

    it('should update bucket', async function () {
        const response = randomBucket();

        const body = {
            objects: response.objects,
            closed: response.closed
        };

        const scope = nock(baseUri, this.options)
            .patch(`/buckets/${response.id}`, body)
            .reply(200, response);

        const bucket = await this.client.buckets.update(response.id, body);

        expect(scope.isDone()).to.be.true;
        expect(bucket).to.deep.equal(transformResponse(response));
    });

    it('should delete bucket', async function () {
        const id = randomObjectId();

        const scope = nock(baseUri, this.options)
            .delete(`/buckets/${id}`)
            .reply(204);

        await this.client.buckets.delete(id);

        expect(scope.isDone()).to.be.true;
    });
});
