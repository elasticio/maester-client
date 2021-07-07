/* eslint-disable max-len */
import 'mocha';
import { getLogger } from '@elastic.io/component-commons-library/lib/logger/logger';
import chai from 'chai';
import nock from 'nock';
import sinon from 'sinon';
import { ObjectStorageWrapper, MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS } from '../src/ObjectStorageWrapper';

const { expect } = chai;

process.env.ELASTICIO_OBJECT_STORAGE_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6IjU2YzIwN2FkYjkxMjExODFlNjUwYzBlZiIsImNvbnRyYWN0SWQiOiI1YjVlZDFjZjI3MmNmODAwMTFhZTdiNmEiLCJ3b3Jrc3BhY2VJZCI6IjVhNzFiZmM1NjA3ZjFiMDAwNzI5OGEyYSIsImZsb3dJZCI6IioiLCJ1c2VySWQiOiI1YjE2NGRiMzRkNTlhODAwMDdiZDQ3OTMiLCJpYXQiOjE1ODg1ODg3NjZ9.3GlJAwHz__e2Y5tgkzD1t-JyhgXGJOSVFSLUBCqLh5Y';
process.env.ELASTICIO_WORKSPACE_ID = 'test';
process.env.ELASTICIO_FLOW_ID = 'test';
process.env.ELASTICIO_API_URI = 'https://api.hostname';
process.env.ELASTICIO_OBJECT_STORAGE_URI = 'https://ma.estr';
process.env.ELASTICIO_STEP_ID = 'step_id';

let context: any;
let objectStorageWrapper: any;

describe('ObjectStorageWrapper', () => {
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
  const ttl = -1;
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
    describe('valid inputs', () => {
      describe('With queriable fields', () => {
        it('Should save the data correctly', async () => {
          nock(maesterUri)
            .post('/objects')
            .matchHeader('x-query-key0', 'value0')
            .matchHeader('x-eio-ttl', '-1')
            .reply(201, createObjectWithQueriableField);
          await objectStorageWrapper.createObject(data, genHeaders(1), ttl);
        });
        it('Should save the data correctly', async () => {
          nock(maesterUri)
            .post('/objects')
            .matchHeader('x-query-key0', 'value0')
            .matchHeader('x-query-key1', 'value1')
            .matchHeader('x-query-key2', 'value2')
            .matchHeader('x-query-key3', 'value3')
            .matchHeader('x-query-key4', 'value4')
            .matchHeader('x-eio-ttl', '-1')
            .reply(201, createObjectWithQueriableField);
          await objectStorageWrapper.createObject(data, genHeaders(MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS), ttl);
        });
      });
      describe('Without queriable fields', () => {
        it('Should save the data correctly', async () => {
          nock(maesterUri).post('/objects').matchHeader('x-eio-ttl', '-1').reply(201, createObjectWithQueriableField);
          await objectStorageWrapper.createObject(data, [], ttl);
        });
        it('Should save the data correctly', async () => {
          nock(maesterUri).post('/objects').reply(201, createObjectWithQueriableField);
          await objectStorageWrapper.createObject(data);
        });
      });
    });
    describe('invalid inputs', () => {
      describe('Query key set, query value undefined', () => {
        it('Should throw error', async () => {
          await objectStorageWrapper
            .createObject(data, [{ key: 'key0', value: 'value0' }, { key: 'key1' }], ttl)
            .catch((error: { message: any }) => {
              expect(error.message).to.equal('header "value" is mandatory if header "key" passed');
            });
        });
      });
      describe('Query value set, query key undefined', () => {
        it('Should throw error', async () => {
          await objectStorageWrapper.createObject(data, [{ value: 'value1' }], ttl).catch((error: { message: any }) => {
            expect(error.message).to.equal('header "key" is mandatory if header "value" passed');
          });
        });
      });
      describe(`Maester headers maximum amount is exceed (${MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS} items)`, () => {
        it('Should throw error', async () => {
          await objectStorageWrapper
            .createObject(data, genHeaders(MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS + 1), ttl)
            .catch((error: { message: any }) => {
              expect(error.message).to.equal(`maximum available amount of headers is ${MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS}`);
            });
        });
      });
      describe('Header used more than one time', () => {
        it('Should throw error', async () => {
          await objectStorageWrapper
            .createObject(
              data,
              [
                { key: 'key0', value: 'value0' },
                { key: 'key0', value: 'value0' },
              ],
              ttl,
            )
            .catch((error: { message: any }) => {
              expect(error.message).to.equal('header key "key0" was already added');
            });
        });
      });
    });
  });
  describe('Lookup object by ID', () => {
    describe('Lookup with valid ID', () => {
      it('Should successfully return a JSON object', async () => {
        nock(maesterUri).get(`/objects/${id}`).reply(200, data);
        const result = await objectStorageWrapper.lookupObjectById(id);
        expect(result).to.deep.equal(rawData);
      });
      it('Should successfully return a string', async () => {
        nock(maesterUri).get(`/objects/${id}`).reply(200, rawData);
        const result = await objectStorageWrapper.lookupObjectById(id);
        expect(result).to.deep.equal(rawData);
      });
    });
  });
  describe('Lookup object by query parameter', () => {
    describe('Object not found in Maester', () => {
      it('Should successfully return an empty stringified array', async () => {
        nock(maesterUri).get(`/objects?query[${queryKey}]=${queryValue}`).reply(200, []);
        const result = await objectStorageWrapper.lookupObjectsByQueryParameters([{ key: queryKey, value: queryValue }]);
        expect(result).to.deep.equal([]);
      });
    });
    describe('Different amount of search params', () => {
      describe('valid input', () => {
        it('Should successfully return an empty stringified array', async () => {
          nock(maesterUri).get('/objects').reply(200, []);
          const result = await objectStorageWrapper.lookupObjectsByQueryParameters([]);
          expect(result).to.deep.equal([]);
        });
        it('Should successfully return an empty stringified array', async () => {
          nock(maesterUri).get('/objects?query[key0]=value0').reply(200, []);
          const result = await objectStorageWrapper.lookupObjectsByQueryParameters(genHeaders(1));
          expect(result).to.deep.equal([]);
        });
        it('Should successfully return an empty stringified array', async () => {
          nock(maesterUri)
            .get('/objects?query[key0]=value0&query[key1]=value1&query[key2]=value2&query[key3]=value3&query[key4]=value4')
            .reply(200, []);
          const result = await objectStorageWrapper.lookupObjectsByQueryParameters(genHeaders(5));
          expect(result).to.deep.equal([]);
        });
        describe('One object found in Maester', () => {
          it('Should return a stringified array of 1 object', async () => {
            nock(maesterUri).get('/objects?query[key0]=value0&query[key1]=value1').reply(200, [createObjectWithQueriableField]);
            const result = await objectStorageWrapper.lookupObjectsByQueryParameters(genHeaders(2));
            expect(result).to.deep.equal([createObjectWithQueriableField]);
          });
        });
        describe('Two objects found in Maester', () => {
          it('Should return a stringified array of 2 objects', async () => {
            nock(maesterUri)
              .get('/objects?query[key0]=value0&query[key1]=value1&query[key2]=value2')
              .reply(200, [createObjectWithQueriableField, anotherCreateObjectWithQueriableField]);
            const result = await objectStorageWrapper.lookupObjectsByQueryParameters(genHeaders(3));
            expect(result).to.deep.equal([createObjectWithQueriableField, anotherCreateObjectWithQueriableField]);
          });
        });
      });
      describe('invalid input', () => {
        describe('Query key set, query value undefined', () => {
          it('Should throw error', async () => {
            await objectStorageWrapper
              .lookupObjectsByQueryParameters([{ key: 'key0', value: 'value0' }, { key: 'key1' }], ttl)
              .catch((error: { message: any }) => {
                expect(error.message).to.equal('header "value" is mandatory if header "key" passed');
              });
          });
        });
        describe('Query value set, query key undefined', () => {
          it('Should throw error', async () => {
            await objectStorageWrapper.lookupObjectsByQueryParameters([{ value: 'value1' }], ttl).catch((error: { message: any }) => {
              expect(error.message).to.equal('header "key" is mandatory if header "value" passed');
            });
          });
        });
        describe(`Maester headers maximum amount is exceed (${MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS} items)`, () => {
          it('Should throw error', async () => {
            await objectStorageWrapper
              .lookupObjectsByQueryParameters(genHeaders(MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS + 1), ttl)
              .catch((error: { message: any }) => {
                expect(error.message).to.equal(`maximum available amount of headers is ${MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS}`);
              });
          });
        });
        describe('Header used more than one time', () => {
          it('Should throw error', async () => {
            await objectStorageWrapper
              .lookupObjectsByQueryParameters(
                [
                  { key: 'key0', value: 'value0' },
                  { key: 'key0', value: 'value0' },
                ],
                ttl,
              )
              .catch((error: { message: any }) => {
                expect(error.message).to.equal('header key "key0" was already added');
              });
          });
        });
      });
    });
  });
  describe('Update object', () => {
    describe('Valid update request', () => {
      it('Should successfully update an object', async () => {
        nock(maesterUri).put(`/objects/${id}`).reply(200, updatedData);
        const result = await objectStorageWrapper.updateObject(id, updatedData);
        expect(result).to.deep.equal(updatedData);
      });
    });
    describe('Delete object', () => {
      describe('ID is valid', () => {
        it('Should delete an object', async () => {
          nock(maesterUri).delete(`/objects/${id}`).reply(204);
          const result = await objectStorageWrapper.deleteObjectById(id);
          expect(result).to.equal('');
        });
      });
    });
  });
});
