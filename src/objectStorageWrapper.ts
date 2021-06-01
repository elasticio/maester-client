import ObjectStorage from './objectStorage';

export interface BucketObject {
  objectId: string;
  lastSeenTime: string;
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

  async createBucketIfNotExists(externalId: string): Promise<{ bucket: Bucket; bucketId: string; isCreated: boolean }> {
    this.logger.debug('running fn createBucketIfNotExists');
    const buckets = await this.objectStorage.getAllByParams({ 'query[externalid]': externalId });
    if (!buckets.length) {
      this.logger.debug('no buckets found');
      const newBucket: Bucket = { objects: [] };
      const bucketId = await this.objectStorage.addOne(newBucket, { 'x-query-externalid': externalId, 'x-eio-ttl': -1 });
      this.logger.debug('created new bucket');
      return { bucket: newBucket, bucketId, isCreated: true };
    }
    this.logger.debug('bucket found');
    const bucketId = buckets[0].objectId;
    const bucket = await this.objectStorage.getById(bucketId);
    return { bucket, bucketId, isCreated: false };
  }

  async createObject(object: BucketObject, bucketId: string) {
    this.logger.debug('running fn createObject');
    const bucket = await this.objectStorage.getById(bucketId);
    this.logger.debug('...updating bucket');
    await this.objectStorage.updateOne(bucketId, { ...bucket, objects: [...bucket.objects, object] });
  }

  async updateObject(id: string, newData: BucketObject, bucketId: string) {
    this.logger.debug('running fn updateObject');
    const bucket = await this.objectStorage.getById(bucketId);
    const objectIndex = bucket.objects.findIndex((obj: BucketObject) => obj.objectId === id);
    bucket.objects[objectIndex] = newData;
    this.logger.debug('...updating bucket');
    await this.objectStorage.updateOne(bucketId, bucket);
  }
}
