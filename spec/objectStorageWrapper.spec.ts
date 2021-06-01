/* eslint-disable max-len */
import 'mocha';
import { getLogger } from '@elastic.io/component-commons-library/lib/logger/logger';
import chai from 'chai';
import nock from 'nock';
import sinon from 'sinon';
import { ObjectStorageWrapper, BucketObject } from '../src/objectStorageWrapper';

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
  lastSeenTime: 'date',
  objectData: { foo: 'bar' },
};

describe('ObjectStorageWrapper', () => {
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

  describe('createBucketIfNotExists', () => {
    it('bucket does not exist, should create bucket and object', async () => {
      //* createBucketIfNotExists
      // objectStorage.getAllByParamsAsStream
      const getBuckets = nock('https://ma.estr').get('/objects?query[externalid]=test-step_id-test').reply(200, []);
      // objectStorage.addAsStream
      const postBucket = nock('https://ma.estr')
        .post('/objects')
        .matchHeader('x-query-externalid', 'test-step_id-test')
        .reply(200, { objectId: 'bucketId' });
      //*

      const result = await objectStorageWrapper.createBucketIfNotExists('test-step_id-test');
      expect(result).to.deep.equal({ bucket: { objects: [] }, bucketId: 'bucketId', isCreated: true });
      expect(getBuckets.isDone()).to.equal(true);
      expect(postBucket.isDone()).to.equal(true);
    });

    it('bucket exist, should get it', async () => {
      //* createBucketIfNotExists
      // objectStorage.getAllByParamsAsStream
      const getBuckets = nock('https://ma.estr')
        .get('/objects?query[externalid]=test-step_id-test')
        .reply(200, [{ objectId: 'bucketId' }]);
      // objectStorage.getById
      const getBucket = nock('https://ma.estr').get('/objects/bucketId').reply(200, { objects: [] });
      //*

      const result = await objectStorageWrapper.createBucketIfNotExists('test-step_id-test');
      expect(result).to.deep.equal({ bucket: { objects: [] }, bucketId: 'bucketId', isCreated: false });
      expect(getBuckets.isDone()).to.equal(true);
      expect(getBucket.isDone()).to.equal(true);
    });
  });

  it('createObject', async () => {
    //* createObject
    // objectStorage.getById
    const getBucket = nock('https://ma.estr').get('/objects/bucketId').reply(200, { objects: [] });
    // objectStorage.updateOne
    const putBucket = nock('https://ma.estr').put('/objects/bucketId').reply(200, {});
    // *

    await objectStorageWrapper.createObject(bucketObject, 'bucketId');
    expect(getBucket.isDone()).to.equal(true);
    expect(putBucket.isDone()).to.equal(true);
  });

  it('updateObject', async () => {
    //* updateObject
    // objectStorage.getById
    const getBucket2 = nock('https://ma.estr')
      .get('/objects/bucketId')
      .reply(200, { objects: [bucketObject] });
    // objectStorage.updateOne
    const putBucket = nock('https://ma.estr').put('/objects/bucketId').reply(200, {});
    // *

    await objectStorageWrapper.updateObject(bucketObject.objectId, bucketObject, 'bucketId');
    expect(getBucket2.isDone()).to.equal(true);
    expect(putBucket.isDone()).to.equal(true);
  });
});
