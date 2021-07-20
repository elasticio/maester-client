import { Readable, Duplex } from 'stream';
import getStream from 'get-stream';
import { StorageClient } from './StorageClient';

export type TransformMiddleware = () => Duplex;

export class ObjectStorage {
  private client: StorageClient;

  private forwards: TransformMiddleware[];

  private reverses: TransformMiddleware[];

  public constructor(config: { uri: string; jwtSecret: string }, client?: StorageClient) {
    this.client = client || new StorageClient(config);
    this.forwards = [];
    this.reverses = [];
  }

  private applyMiddlewares(stream: Readable, middlewares: TransformMiddleware[]): Readable {
    // eslint-disable-next-line no-shadow
    return middlewares.reduce((stream, middleware) => stream.pipe(middleware()), stream);
  }

  private formStream(data: object): Readable {
    const dataString = JSON.stringify(data);
    const stream = new Readable();
    stream.push(dataString);
    stream.push(null);
    return stream;
  }

  public use(forward: TransformMiddleware, reverse: TransformMiddleware): ObjectStorage {
    this.forwards.push(forward);
    this.reverses.unshift(reverse);
    return this;
  }

  public async getById(objectId: string): Promise<string> {
    const { data } = await this.client.readStream(objectId);
    const stream = this.applyMiddlewares(data, this.reverses);
    return getStream(stream);
  }

  public async getAllByParams(params: object): Promise<string> {
    const { data } = await this.client.readAllByParamsAsStream(params);
    const stream = this.applyMiddlewares(data, this.reverses);
    return getStream(stream);
  }

  public async deleteOne(objectId: string): Promise<string> {
    const { data } = await this.client.deleteOne(objectId);
    const stream = this.applyMiddlewares(data, this.reverses);
    return getStream(stream);
  }

  public async deleteMany(params: object): Promise<string> {
    const { data } = await this.client.deleteMany(params);
    const stream = this.applyMiddlewares(data, this.reverses);
    return getStream(stream);
  }

  public async postObject(data: object, headers: object): Promise<string> {
    const resultStream = () => this.applyMiddlewares(this.formStream(data), this.forwards);
    const res = await this.client.writeStream(resultStream, headers);
    return res.data;
  }

  public async updateOne(objectId: string, data: object, headers?: object): Promise<string> {
    const resultStream = () => this.applyMiddlewares(this.formStream(data), this.forwards);
    const res = await this.client.updateAsStream(objectId, resultStream, headers);
    return res.data;
  }
}
