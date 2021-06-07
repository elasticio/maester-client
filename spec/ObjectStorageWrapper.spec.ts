/* eslint-disable max-len */
import 'mocha';
import { getLogger } from '@elastic.io/component-commons-library/lib/logger/logger';
import chai from 'chai';
import nock from 'nock';
import sinon from 'sinon';
import { ObjectStorageWrapper, BucketObject } from '../src/ObjectStorageWrapper';

const { expect } = chai;

process.env.ELASTICIO_OBJECT_STORAGE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6IjU2YzIwN2FkYjkxMjExODFlNjUwYzBlZiIsImNvbnRyYWN0SWQiOiI1YjVlZDFjZjI3MmNmODAwMTFhZTdiNmEiLCJ3b3Jrc3BhY2VJZCI6IjVhNzFiZmM1NjA3ZjFiMDAwNzI5OGEyYSIsImZsb3dJZCI6IioiLCJ1c2VySWQiOiI1YjE2NGRiMzRkNTlhODAwMDdiZDQ3OTMiLCJpYXQiOjE1ODg1ODg3NjZ9.3GlJAwHz__e2Y5tgkzD1t-JyhgXGJOSVFSLUBCqLh5Y';
process.env.ELASTICIO_WORKSPACE_ID = 'test';
process.env.ELASTICIO_FLOW_ID = 'test';
process.env.ELASTICIO_API_URI = 'https://api.hostname';
process.env.ELASTICIO_OBJECT_STORAGE_URI = 'https://ma.estr';
process.env.ELASTICIO_STEP_ID = 'step_id';

let context: any;
let objectStorageWrapper: any;
const bucketObject: BucketObject = {
  objectId: 'objectId',
  lastSeenTime: new Date(),
  objectData: { foo: 'bar' },
};

describe('ObjectStorageWrapper', () => {
  const objectNotFoundResponse = 'Object Not Found';
  const invalidIdResponse = 'Invalid object id';
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
  const ttl = -1;
  const id = 'id123';
  const maesterUri = 'https://ma.estr';
  const createObjectWithoutQueriableField = {
    contentType: 'application/json',
    createdAt: 1622811501107,
    objectId: '2bd48165-119f-489d-8842-8d07b2c7cc1b',
    metadata: {},
    queriableFields: {},
  };
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
  const stringifiedArrayOfOneObject = '[{"contentType":"application/json","createdAt":1622811501107,"objectId":"2bd48165-119f-489d-8842-8d07b2c7cc1b","metadata":{},"queriableFields":{"demosearchfield":"qwerty"}}]';
  const stringifiedArrayOfTwoObjects = '[{"contentType":"application/json","createdAt":1622811501107,"objectId":"2bd48165-119f-489d-8842-8d07b2c7cc1b","metadata":{},"queriableFields":{"demosearchfield":"qwerty"}},{"contentType":"application/json","createdAt":1622811501108,"objectId":"78asdas87-ss77-77ss-7888-8d07b2c7cc2a","metadata":{},"queriableFields":{"demosearchfield":"qwerty"}}]';

  before(async () => {
    context = {
      logger: getLogger(),
      emit: sinon.spy(),
    };
    objectStorageWrapper = new ObjectStorageWrapper(context);
  });

  beforeEach(async () => {
    context.emit.resetHistory();
  });

  after(() => {
    nock.restore();
    nock.cleanAll();
    nock.activate();
  });

  describe('Create object', () => {
    describe('With queriable fields', () => {
      it('Should save the data correctly', async () => {
        nock(maesterUri)
          .post('/objects')
          .matchHeader('x-query-baz', queryValue)
          .reply(200, createObjectWithQueriableField);
        const result = await objectStorageWrapper.createObject(data, queryKey, queryValue, ttl);
        expect(result).to.deep.equal(createObjectWithQueriableField);
      });
    });
    describe('Without queriable fields', () => {
      it('Should save the data correctly', async () => {
        nock(maesterUri)
          .post('/objects')
          .matchHeader('x-query-baz', queryValue)
          .reply(200, createObjectWithoutQueriableField);
        const result = await objectStorageWrapper.createObject(data, queryKey, queryValue, ttl);
        expect(result).to.deep.equal(createObjectWithoutQueriableField);
      });
    });
    describe('Query key set, query value undefined', () => {
      it('Should throw error', async () => {
        await objectStorageWrapper.createObject(data, queryKey, undefined).catch((error: { message: any; }) => {
          expect(error.message).to.equal('queryValue is mandatory if queryKey passed');
        });
      });
    });
    describe('Query key set, query value undefined', () => {
      it('Should throw error', async () => {
        await objectStorageWrapper.createObject(data, undefined, queryValue, undefined).catch((error: { message: any; }) => {
          expect(error.message).to.equal('queryKey is mandatory if queryValue passed');
        });
      });
    });
  });
  describe('Lookup object by ID', () => {
    describe('Object not found in Maester', () => {
      it('Should return "object not found"', async () => {
        nock(maesterUri)
          .get(`/objects/${id}`)
          .reply(200, objectNotFoundResponse);
        const result = await objectStorageWrapper.lookupObjectById(id);
        expect(result).to.equal(objectNotFoundResponse);
      });
    });
    describe('ID is invalid', () => {
      it('Should return "invalid object id"', async () => {
        nock(maesterUri)
          .get(`/objects/${id}`)
          .reply(200, invalidIdResponse);
        const result = await objectStorageWrapper.lookupObjectById(id);
        expect(result).to.equal(invalidIdResponse);
      });
    });
    describe('Lookup with valid ID', () => {
      it('Should successfully return a JSON object', async () => {
        nock(maesterUri)
          .get(`/objects/${id}`)
          .reply(200, data);
        const result = await objectStorageWrapper.lookupObjectById(id);
        expect(result).to.deep.equal(rawData);
      });
      it('Should successfully return a string', async () => {
        nock(maesterUri)
          .get(`/objects/${id}`)
          .reply(200, rawData);
        const result = await objectStorageWrapper.lookupObjectById(id);
        expect(result).to.deep.equal(rawData);
      });
    });
  });
  describe('Lookup object by query parameter', () => {
    describe('Object not found in Maester', () => {
      it('Should successfully return an empty stringified array', async () => {
        nock(maesterUri)
          .get(`/objects?query[${queryKey}]=${queryValue}`)
          .reply(200, []);
        const result = await objectStorageWrapper.lookupObjectByQueryParameter(queryKey, queryValue);
        expect(result).to.deep.equal('[]');
      });
    });
    describe('One object found in Maester', () => {
      it('Should return a stringified array of 1 object', async () => {
        nock(maesterUri)
          .get(`/objects?query[${queryKey}]=${queryValue}`)
          .reply(200, [createObjectWithQueriableField]);
        const result = await objectStorageWrapper.lookupObjectByQueryParameter(queryKey, queryValue);
        expect(result).to.deep.equal(stringifiedArrayOfOneObject);
      });
    });
    describe('Two objects found in Maester', () => {
      it('Should return a stringified array of 2 objects', async () => {
        nock(maesterUri)
          .get(`/objects?query[${queryKey}]=${queryValue}`)
          .reply(200, [createObjectWithQueriableField, anotherCreateObjectWithQueriableField]);
        const result = await objectStorageWrapper.lookupObjectByQueryParameter(queryKey, queryValue);
        expect(result).to.deep.equal(stringifiedArrayOfTwoObjects);
      });
    });
  });
  describe('Update object', () => {
    describe('Object not found in Maester', () => {
      it('Should return "object not found"', async () => {
        nock(maesterUri)
          .get(`/objects/${id}`)
          .reply(200, objectNotFoundResponse);
        await objectStorageWrapper.updateObject(id, data).catch((error: { message: any; }) => {
          expect(error.message).to.equal('No objects found with id id123');
        });
      });
    });
    describe('ID is invalid', () => {
      it('Should return "invalid object id"', async () => {
        nock(maesterUri)
          .get(`/objects/${id}`)
          .reply(200, invalidIdResponse);
        await objectStorageWrapper.updateObject(id, data).catch((error: { message: any; }) => {
          expect(error.message).to.equal('Invalid object id id123');
        });
      });
    });
    describe('Valid update request', () => {
      it('Should successfully update an object', async () => {
        nock(maesterUri)
          .get(`/objects/${id}`)
          .reply(200, data);
        nock(maesterUri)
          .put(`/objects/${id}`)
          .reply(200, updatedData);
        const result = await objectStorageWrapper.updateObject(id, updatedData);
        expect(result).to.deep.equal(updatedData);
      });
    });
    describe('Delete object', () => {
      describe('Object not found in Maester', () => {
        it('Should return "object not found"', async () => {
          nock(maesterUri)
            .delete(`/objects/${id}`)
            .reply(200, objectNotFoundResponse);
          const result = await objectStorageWrapper.deleteObjectById(id);
          expect(result).to.equal(objectNotFoundResponse);
        });
      });
      describe('ID is invalid', () => {
        it('Should return "invalid object id"', async () => {
          nock(maesterUri)
            .delete(`/objects/${id}`)
            .reply(200, invalidIdResponse);
          const result = await objectStorageWrapper.deleteObjectById(id);
          expect(result).to.equal(invalidIdResponse);
        });
      });
      describe('ID is valid', () => {
        it('Should delete an object', async () => {
          nock(maesterUri)
            .delete(`/objects/${id}`)
            .reply(204);
          const result = await objectStorageWrapper.deleteObjectById(id);
          expect(result).to.equal('');
        });
      });
    });
  });
});
