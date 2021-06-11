import ObjectStorage from './ObjectStorage';

export interface BucketObject {
  objectId: string;
  lastSeenTime: Date;
  objectData: any;
}

export interface Bucket {
  objects: Array<BucketObject>;
}

export interface Scope {
  logger: object;
}

export class ObjectStorageWrapper {
  logger: any;

  token: string;

  url: string;

  objectStorage: any;

  constructor(context: Scope) {
    this.logger = context.logger;
    if (!process.env.ELASTICIO_OBJECT_STORAGE_TOKEN || !process.env.ELASTICIO_OBJECT_STORAGE_URI) {
      throw new Error('Can not find storage token or storage uri values... Check environment variables');
    }
    this.token = process.env.ELASTICIO_OBJECT_STORAGE_TOKEN;
    this.url = process.env.ELASTICIO_OBJECT_STORAGE_URI;
    this.objectStorage = new ObjectStorage({ uri: this.url, jwtSecret: this.token });
  }

  async createObject(data: object, queryKey?: string, queryValue?: string, ttl?: number) {
    this.logger.debug('Going to create an object...');
    let headers = {};
    if (queryKey && !queryValue) throw new Error('queryValue is mandatory if queryKey passed');
    if (!queryKey && queryValue) throw new Error('queryKey is mandatory if queryValue passed');
    if (queryKey && queryValue) headers = ObjectStorageWrapper.buildQueryHeader(headers, queryKey, queryValue);
    if (ttl) headers = ObjectStorageWrapper.buildTtlHeader(headers, ttl);
    return this.objectStorage.postObject(data, headers);
  }

  async deleteObjectById(id: string) {
    this.logger.debug(`Going to delete an object with id ${id}...`);
    return this.objectStorage.deleteOne(id);
  }

  async lookupObjectById(id: string) {
    this.logger.debug(`Going to find an object by id ${id}...`);
    const resultString = await this.objectStorage.getById(id);
    if (resultString === 'Object Not Found') throw new Error('Object Not Found');
    if (resultString === 'Invalid object id') throw new Error('Invalid object id');
    return resultString;
  }

  async lookupObjectByQueryParameter(key: string, value: string) {
    const queryKey = 'query['.concat(key, ']');
    this.logger.debug(`Going to find an object by query '${queryKey}': '${value}'...`);
    return this.objectStorage.getAllByParams({ [queryKey]: value });
  }

  async updateObject(id: string, data: object) {
    this.logger.debug('Going to find an object by id...');
    const findObject = await this.objectStorage.getById(id);
    if (findObject === 'Object Not Found') throw new Error(`No objects found with id ${id}`);
    if (findObject === 'Invalid object id') throw new Error(`Invalid object id ${id}`);
    this.logger.debug(`Going to update and object with id ${id}...`);
    return this.objectStorage.updateOne(id, data);
  }

  private static buildQueryHeader(headers: object, queryKey: string, queryValue: string) {
    const xQueryKey = 'x-query-'.concat(queryKey);
    return ObjectStorageWrapper.buildHeader(headers, xQueryKey, queryValue);
  }

  private static buildTtlHeader(headers: any, ttl: number) {
    return ObjectStorageWrapper.buildHeader(headers, 'x-eio-ttl', ttl);
  }

  private static buildHeader(headers: any, key: string, value: string|number) {
    headers = { ...headers, ...{ [key]: value } };
    return headers;
  }
}
