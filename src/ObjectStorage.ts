import { Readable, Duplex, Stream } from 'stream';
import getStream from 'get-stream';
import { StorageClient } from './StorageClient';

export type TransformMiddleware = () => Duplex;
export type ResponseType = 'stream' | 'json' | 'arraybuffer';
export const DEFAULT_RESPONSE_TYPE: ResponseType = 'json';

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

  public async getById(objectId: string, responseType: ResponseType = DEFAULT_RESPONSE_TYPE): Promise<any> {
    const { data } = await this.client.readStream(objectId);
    const stream = this.applyMiddlewares(data, this.reverses);
    return ObjectStorage.getDataByResponseType(stream, responseType);
  }

  public async getAllByParams(params: object): Promise<string> {
    const res = await this.client.readAllByParamsAsStream(params);
    return res.data;
  }

  public async deleteOne(objectId: string): Promise<any> {
    return this.client.deleteOne(objectId);
  }

  public async deleteMany(params: object): Promise<any> {
    return this.client.deleteMany(params);
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

  private static getDataByResponseType(data: Stream, responseType: ResponseType) {
    switch (responseType) {
      case 'stream': return data;
      case 'json': return getStream(data);
      case 'arraybuffer': return getStream.buffer(data);
      default: throw new Error(`Response type "${responseType}" is not supported`);
    }
  }
}
