import fs from 'fs';
import dotenv from 'dotenv';
import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import {Client} from "../src";


describe('objects', function () {
    before(function () {
        if (fs.existsSync('.env')) {
            dotenv.config();
        }
        this.client = new Client(process.env.MAESTER_URL || '', process.env.TOKEN || '') ;
    })

    describe('get object', function () {
        it('should create and get object', async function () {
            const data = 'test';
            const contentType = 'application/octet-stream';
            const contentLength = 4;

            const params = {
                objectFields: {
                    key1: {
                        Meta: 'someMeta',
                        Query: 'someQuery',
                    }
                }
            };
            const object = await this.client.objects.create(data, params);
            expect(object.contentType).to.equal(contentType);
            const response = await this.client.objects.get(object.id);

            expect(response.contentType).to.equal(contentType);
            expect(response.contentLength).to.equal(contentLength);
            expect(response.data).to.deep.equal(data);
            expect(response.queriableFields).to.deep.equal({ key1: 'someQuery'});
        });
    });
});
