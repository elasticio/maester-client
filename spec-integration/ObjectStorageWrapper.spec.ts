import chai, { expect } from 'chai';
import { anyNonNil as isUUID } from 'is-uuid';
import { ObjectStorageWrapper } from '../src';
import { getContext } from './common';

chai.use(require('chai-as-promised'));

describe('ObjectStorageWrapper', () => {
  const objectStorageWrapper = new ObjectStorageWrapper(getContext());
  const genHeaders = (amount: number) => {
    const resultHeaders = [];
    for (let i = 0; i < amount; i++) {
      resultHeaders.push({ key: `key${i}`, value: `value${i}` });
    }
    return resultHeaders;
  };
  it('should createObject & getObjectHeaders', async () => {
    const objectId = await objectStorageWrapper.createObject({ a: 5 }, genHeaders(2), genHeaders(3));
    expect(isUUID(objectId)).to.be.equal(true);
    const object = await objectStorageWrapper.lookupObjectById(objectId);
    expect(object).to.be.deep.equal({ a: 5 });
    const headers = await objectStorageWrapper.getObjectHeaders(objectId);
    expect(headers['content-type']).to.be.equal('application/json');
    expect(headers['x-meta-key0']).to.be.equal('value0');
    expect(headers['x-meta-key1']).to.be.equal('value1');
    expect(headers['x-meta-key2']).to.be.equal('value2');
    expect(headers['x-query-key0']).to.be.equal('value0');
    expect(headers['x-query-key1']).to.be.equal('value1');
  });
  it('should createObject (number)', async () => {
    const objectId = await objectStorageWrapper.createObject(8);
    expect(isUUID(objectId)).to.be.equal(true);
    const object = await objectStorageWrapper.lookupObjectById(objectId);
    expect(object).to.be.deep.equal(8);
    const headers = await objectStorageWrapper.getObjectHeaders(objectId);
    expect(headers['content-type']).to.be.equal('application/json');
  });
  it('should createObject (array)', async () => {
    const objectId = await objectStorageWrapper.createObject([1, 'dva', null]);
    expect(isUUID(objectId)).to.be.equal(true);
    const object = await objectStorageWrapper.lookupObjectById(objectId);
    expect(object).to.be.deep.equal([1, 'dva', null]);
    const headers = await objectStorageWrapper.getObjectHeaders(objectId);
    expect(headers['content-type']).to.be.equal('application/json');
  });
  it('should createObject (string)', async () => {
    const objectId = await objectStorageWrapper.createObject('[1, dva, null]');
    expect(isUUID(objectId)).to.be.equal(true);
    const object = await objectStorageWrapper.lookupObjectById(objectId);
    expect(object).to.be.deep.equal('[1, dva, null]');
    const headers = await objectStorageWrapper.getObjectHeaders(objectId);
    expect(headers['content-type']).to.be.equal('application/json');
  });
  describe('lookupObjectById', () => {
    it('should lookupObjectById', async () => {
      const objectId = await objectStorageWrapper.createObject({ a: 2 });
      expect(isUUID(objectId)).to.be.equal(true);
      const object = await objectStorageWrapper.lookupObjectById(objectId);
      expect(object).to.be.deep.equal({ a: 2 });
    });
    it('should throw 404', async () => {
      await expect(objectStorageWrapper.lookupObjectById('fa208d86-6b81-408e-87f3-4b6e90be7db9')).to.be.rejectedWith('Request failed with status code 404');
    });
    it('should throw 400', async () => {
      await expect(objectStorageWrapper.lookupObjectById('invalid-id')).to.be.rejectedWith('Request failed with status code 400');
    });
  });
  describe('deleteObjectById', () => {
    it('should deleteObjectById', async () => {
      const objectId = await objectStorageWrapper.createObject({ a: 2 });
      expect(isUUID(objectId)).to.be.equal(true);
      const { data } = await objectStorageWrapper.deleteObjectById(objectId);
      expect(data).to.be.equal('');
    });
    it('should throw 404', async () => {
      await expect(objectStorageWrapper.deleteObjectById('fa208d86-6b81-408e-87f3-4b6e90be7db9')).to.be.rejectedWith('Request failed with status code 404');
    });
    it('should throw 400', async () => {
      await expect(objectStorageWrapper.deleteObjectById('invalid-id')).to.be.rejectedWith('Request failed with status code 400');
    });
  });
  describe('lookupObjectsByQueryParameters & deleteObjectsByQueryParameters', () => {
    it('should lookupObjectsByQueryParameters & deleteObjectsByQueryParameters', async () => {
      await objectStorageWrapper.createObject({ a: 2 }, [{ key: 'ewq', value: '11' }]);
      await objectStorageWrapper.createObject({ a: 2 }, [{ key: 'ewq', value: '11' }]);
      await objectStorageWrapper.createObject({ a: 2 }, [], [{ key: 'ewq', value: '11' }]);
      const resultBeforeDelete = await objectStorageWrapper.lookupObjectsByQueryParameters([{ key: 'ewq', value: '11' }]);
      expect(resultBeforeDelete.length).to.be.equal(2);
      await objectStorageWrapper.deleteObjectsByQueryParameters([{ key: 'ewq', value: '11' }]);
      const resultAfterDelete = await objectStorageWrapper.lookupObjectsByQueryParameters([{ key: 'ewq', value: '11' }]);
      expect(resultAfterDelete.length).to.be.equal(0);
    });
  });
  describe('updateObjectById', () => {
    it('should updateObjectById', async () => {
      const objectId = await objectStorageWrapper.createObject({ a: 2 });
      expect(isUUID(objectId)).to.be.equal(true);
      const updated = await objectStorageWrapper.updateObjectById(objectId, { a: 3 });
      expect(updated.objectId).to.be.equal(objectId);
      const object = await objectStorageWrapper.lookupObjectById(objectId);
      expect(object).to.be.deep.equal({ a: 3 });
    });
    it('should updateObjectById (string)', async () => {
      const objectId = await objectStorageWrapper.createObject({ a: 2 });
      expect(isUUID(objectId)).to.be.equal(true);
      const updated = await objectStorageWrapper.updateObjectById(objectId, 'hey');
      expect(updated.objectId).to.be.equal(objectId);
      const object = await objectStorageWrapper.lookupObjectById(objectId);
      expect(object).to.be.deep.equal('hey');
    });
    it('should throw 404', async () => {
      await expect(objectStorageWrapper.updateObjectById('fa208d86-6b81-408e-87f3-4b6e90be7db9', {})).to.be.rejectedWith('Request failed with status code 404');
    });
    it('should throw 400', async () => {
      await expect(objectStorageWrapper.updateObjectById('invalid-id', {})).to.be.rejectedWith('Request failed with status code 400');
    });
  });
});
