/* eslint-disable max-len */
import 'mocha';
import chai, { expect } from 'chai';
import nock from 'nock';
import sinon from 'sinon';
import { Readable } from 'stream';
import chaiAsPromised from 'chai-as-promised';
import bunyan from '@elastic.io/bunyan-logger';
import { getContext } from './helpers';
import { ObjectStorageWrapper, StorageClient, MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS } from '../src';

chai.use(chaiAsPromised);

process.env.ELASTICIO_OBJECT_STORAGE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6I';
process.env.ELASTICIO_WORKSPACE_ID = 'test';
process.env.ELASTICIO_FLOW_ID = 'test';
process.env.ELASTICIO_API_URI = 'https://api.hostname';
process.env.ELASTICIO_OBJECT_STORAGE_URI = 'https://ma.estr';
process.env.ELASTICIO_STEP_ID = 'step_id';

describe.only('ObjectStorageWrapper', () => {
  const objectStorageWrapper = new ObjectStorageWrapper(getContext());
  const genHeaders = (amount: number) => {
    const resultHeaders = [];
    for (let i = 0; i < amount; i++) {
      resultHeaders.push({ key: `key${i}`, value: `value${i}` });
    }
    return resultHeaders;
  };
  const data = {
    foo: 'bar',
  };
  const updatedData = {
    foo: 'bar',
    bap: 'baz',
  };
  const rawData = '{"foo":"bar"}';
  const queryKey = 'baz';
  const queryValue = 'bap';
  const ttl = 10;
  const id = 'id123';
  const maesterUri = 'https://ma.estr';
  const createObjectWithQueriableField = {
    contentType: 'application/json',
    createdAt: 1622811501107,
    objectId: '2bd48165-119f-489d-8842-8d07b2c7cc1b',
    metadata: {},
    queriableFields: {
      demosearchfield: 'qwerty',
    },
  };
  const anotherCreateObjectWithQueriableField = {
    contentType: 'application/json',
    createdAt: 1622811501108,
    objectId: '78asdas87-ss77-77ss-7888-8d07b2c7cc2a',
    metadata: {},
    queriableFields: {
      demosearchfield: 'qwerty',
    },
  };

  let finalReqCfg;

  afterEach(sinon.restore);

  describe('Create object', () => {
    beforeEach(async () => {
      finalReqCfg = sinon.stub(StorageClient.prototype, <any>'requestRetry').callsFake(async () => ({ data: createObjectWithQueriableField }));
    });
    describe('valid inputs', () => {
      it('Should save the data correctly (1 q-header, ttl-value)', async () => {
        const result = await objectStorageWrapper.createObject(data, genHeaders(1), [], ttl);
        expect(result).to.be.equal(createObjectWithQueriableField.objectId);
        const { firstArg, lastArg } = finalReqCfg.getCall(0);
        expect(lastArg).to.be.deep.equal({});
        const stream = await firstArg.getFreshStream();
        expect(stream instanceof Readable).to.be.equal(true);
        expect(firstArg.axiosReqConfig).to.be.deep.equal({
          method: 'post',
          url: '/objects',
          headers: {
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6I',
            'content-type': 'application/json',
            'x-query-key0': 'value0',
            'x-eio-ttl': '10'
          }
        });
      });
      it('Should save the data correctly (2 q-header, 3 q-header)', async () => {
        const result = await objectStorageWrapper.createObject(data, genHeaders(2), genHeaders(3));
        expect(result).to.be.equal(createObjectWithQueriableField.objectId);
        const { firstArg, lastArg } = finalReqCfg.getCall(0);
        expect(lastArg).to.be.deep.equal({});
        const stream = await firstArg.getFreshStream();
        expect(stream instanceof Readable).to.be.equal(true);
        expect(firstArg.axiosReqConfig).to.be.deep.equal({
          method: 'post',
          url: '/objects',
          headers: {
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6I',
            'content-type': 'application/json',
            'x-query-key0': 'value0',
            'x-query-key1': 'value1',
            'x-meta-key0': 'value0',
            'x-meta-key1': 'value1',
            'x-meta-key2': 'value2',
          }
        });
      });
      it('Should save the data correctly (no headers)', async () => {
        const result = await objectStorageWrapper.createObject(data);
        expect(result).to.be.equal(createObjectWithQueriableField.objectId);
        const { firstArg, lastArg } = finalReqCfg.getCall(0);
        expect(lastArg).to.be.deep.equal({});
        const stream = await firstArg.getFreshStream();
        expect(stream instanceof Readable).to.be.equal(true);
        expect(firstArg.axiosReqConfig).to.be.deep.equal({
          method: 'post',
          url: '/objects',
          headers: {
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6I',
            'content-type': 'application/json',
          }
        });
      });
      it('Should save the data correctly (no headers)', async () => {
        const result = await objectStorageWrapper.createObject(data, [], []);
        expect(result).to.be.equal(createObjectWithQueriableField.objectId);
        const { firstArg, lastArg } = finalReqCfg.getCall(0);
        expect(lastArg).to.be.deep.equal({});
        const stream = await firstArg.getFreshStream();
        expect(stream instanceof Readable).to.be.equal(true);
        expect(firstArg.axiosReqConfig).to.be.deep.equal({
          method: 'post',
          url: '/objects',
          headers: {
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6I',
            'content-type': 'application/json',
          }
        });
      });
    });
    describe('invalid inputs', () => {
      it('Should throw error', async () => {
        await expect(
          // @ts-ignore
          objectStorageWrapper.createObject(data, [{ key: 'key0', value: 'value0' }, { key: 'key1' }], [], ttl)
        ).to.be.rejectedWith('header "value" is mandatory if header "key" passed');
      });
      it('Should throw error', async () => {
        await expect(
          // @ts-ignore
          objectStorageWrapper.createObject(data, [{ value: 'value1' }], [], ttl)
        ).to.be.rejectedWith('header "key" is mandatory if header "value" passed');
      });
      it(`Should throw error, Maester headers maximum amount is exceed (${MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS} items)`, async () => {
        await expect(
          // @ts-ignore
          objectStorageWrapper.createObject(data, genHeaders(MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS + 1), [], ttl)
        ).to.be.rejectedWith(`maximum available amount of headers is ${MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS}`);
      });
      it('Should throw error, Header used more than one time', async () => {
        await expect(
          // @ts-ignore
          objectStorageWrapper.createObject(
            data,
            [
              { key: 'key0', value: 'value0' },
              { key: 'key1', value: 'value0' },
              { key: 'key0', value: 'value0' },
            ],
            [],
            ttl,
          )
        ).to.be.rejectedWith('header key "key0" was already added');
      });
    });
  });
  describe('Lookup object by ID', () => {
    beforeEach(async () => {
      finalReqCfg = sinon.stub(StorageClient.prototype, <any>'requestRetry').callsFake(async () => ({ data }));
    });
    it('Should successfully return object', async () => {
      const result = await objectStorageWrapper.lookupObjectById(id);
      expect(result).to.be.equal(data);
      const { firstArg, lastArg } = finalReqCfg.getCall(0);
      expect(lastArg).to.be.deep.equal({});
      expect(firstArg.getFreshStream).to.be.equal(undefined);
      expect(firstArg.axiosReqConfig).to.deep.equal({
        method: 'get',
        url: '/objects/id123',
        responseType: 'stream',
        params: {},
        headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6I' }
      });
    });
  });
  describe('Lookup objects by query parameters', () => {
    beforeEach(async () => {
      finalReqCfg = sinon.stub(StorageClient.prototype, <any>'requestRetry').callsFake(async () => ({ data: [createObjectWithQueriableField, createObjectWithQueriableField] }));
    });
    it('Should return 2 objects', async () => {
      // nock(maesterUri).get(`/objects?query[${queryKey}]=${queryValue}`).reply(200, []);
      const result = await objectStorageWrapper.lookupObjectsByQueryParameters([{ key: queryKey, value: queryValue }]);
      expect(result).to.deep.equal([createObjectWithQueriableField, createObjectWithQueriableField]);
      const { firstArg, lastArg } = finalReqCfg.getCall(0);
      expect(lastArg).to.be.deep.equal({});
      expect(firstArg.getFreshStream).to.be.equal(undefined);
      expect(firstArg.axiosReqConfig).to.deep.equal({
        method: 'get',
        url: '/objects',
        responseType: 'stream',
        params: { 'query[baz]': 'bap' },
        headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6I' }
      });
    });
    it('Should throw error: query key set, query value undefined', async () => {
      await expect(
        // @ts-ignore
        objectStorageWrapper.lookupObjectsByQueryParameters([{ key: 'key0', value: 'value0' }, { key: 'key1' }])
      ).to.be.rejectedWith('header "value" is mandatory if header "key" passed');
    });
    //     describe('Query value set, query key undefined', () => {
    //       it('Should throw error', async () => {
    //         await objectStorageWrapper.lookupObjectsByQueryParameters([{ value: 'value1' }]).catch((error: { message: any }) => {
    //           expect(error.message).to.equal('header "key" is mandatory if header "value" passed');
    //         });
    //       });
    //     });
    //     describe(`Maester headers maximum amount is exceed (${MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS} items)`, () => {
    //       it('Should throw error', async () => {
    //         await objectStorageWrapper
    //           .lookupObjectsByQueryParameters(genHeaders(MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS + 1))
    //           .catch((error: { message: any }) => {
    //             expect(error.message).to.equal(`maximum available amount of headers is ${MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS}`);
    //           });
    //       });
    //     });
    //     describe('Header used more than one time', () => {
    //       it('Should throw error', async () => {
    //         await objectStorageWrapper
    //           .lookupObjectsByQueryParameters(
    //             [
    //               { key: 'key0', value: 'value0' },
    //               { key: 'key0', value: 'value0' },
    //             ],
    //           )
    //           .catch((error: { message: any }) => {
    //             expect(error.message).to.equal('header key "key0" was already added');
    //           });
    //       });
    //     });
    //     it('At least one header must be present', async () => {
    //       try {
    //         await objectStorageWrapper.lookupObjectsByQueryParameters([]);
    //       } catch (error) {
    //         expect(error.message).to.be.equal('At least one query header must be present');
    //       }
    //     });
    //   });
    // });
  });
  describe('Update object', () => {
    beforeEach(async () => {
      finalReqCfg = sinon.stub(StorageClient.prototype, <any>'requestRetry').callsFake(async () => ({ data: createObjectWithQueriableField }));
    });
    describe('Valid update request', () => {
      it('Should successfully update an object', async () => {
        const result = await objectStorageWrapper.updateObject(id, updatedData);
        expect(result).to.deep.equal(createObjectWithQueriableField);
        const { firstArg, lastArg } = finalReqCfg.getCall(0);
        expect(lastArg).to.be.deep.equal({});
        const stream = await firstArg.getFreshStream();
        expect(stream instanceof Readable).to.be.equal(true);
        expect(firstArg.axiosReqConfig).to.be.deep.equal({
          method: 'put',
          url: '/objects/id123',
          headers: {
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6I',
            'content-type': 'application/json'
          }
        });
      });
      it('Should successfully update an object with headers', async () => {
        const result = await objectStorageWrapper.updateObject(id, updatedData, genHeaders(3), genHeaders(2));
        expect(result).to.deep.equal(createObjectWithQueriableField);
        const { firstArg, lastArg } = finalReqCfg.getCall(0);
        expect(lastArg).to.be.deep.equal({});
        const stream = await firstArg.getFreshStream();
        expect(stream instanceof Readable).to.be.equal(true);
        expect(firstArg.axiosReqConfig).to.be.deep.equal({
          method: 'put',
          url: '/objects/id123',
          headers: {
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6I',
            'content-type': 'application/json',
            'x-query-key0': 'value0',
            'x-query-key1': 'value1',
            'x-query-key2': 'value2',
            'x-meta-key0': 'value0',
            'x-meta-key1': 'value1'
          }
        });
      });
    });
    describe('Invalid update request', () => {
      it('Should throw an error', async () => {
        await expect(
          // @ts-ignore
          objectStorageWrapper.updateObject(
            id,
            updatedData,
            [
              { key: 'key0', value: 'value0' },
              { key: 'key0', value: 'value0' },
            ],
          )
        ).to.be.rejectedWith('header key "key0" was already added');
      });
    });
  });
  describe('Delete object by ID', () => {
    beforeEach(async () => {
      finalReqCfg = sinon.stub(StorageClient.prototype, <any>'requestRetry').callsFake(async () => ({ data: '' }));
    });
    it('should delete object by ID', async () => {
      const result = await objectStorageWrapper.deleteObjectById(id);
      expect(result.data).to.be.equal('');
      const { firstArg, lastArg } = finalReqCfg.getCall(0);
      expect(lastArg).to.be.deep.equal({});
      expect(firstArg.getFreshStream).to.be.equal(undefined);
      expect(firstArg.axiosReqConfig).to.be.deep.equal({
        method: 'delete',
        url: '/objects/id123',
        params: {},
        headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6I' }
      });
    });
  });
  describe('Delete object by query parameter', () => {
    beforeEach(async () => {
      finalReqCfg = sinon.stub(StorageClient.prototype, <any>'requestRetry').callsFake(async () => ({ data: '' }));
    });
    describe('Different amount of search params', () => {
      describe('valid input', () => {
        it('Should successfully delete objects (one param)', async () => {
          const result = await objectStorageWrapper.deleteObjectsByQueryParameters(genHeaders(2));
          expect(result.data).to.be.equal('');
          const { firstArg, lastArg } = finalReqCfg.getCall(0);
          expect(lastArg).to.be.deep.equal({});
          expect(firstArg.getFreshStream).to.be.equal(undefined);
          expect(firstArg.axiosReqConfig).to.be.deep.equal({
            method: 'delete',
            url: '/objects',
            params: { 'query[key0]': 'value0', 'query[key1]': 'value1' },
            headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6I' }
          });
        });
      });
    });
  });
});
