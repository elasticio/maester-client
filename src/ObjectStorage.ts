/* eslint-disable class-methods-use-this */
import { Readable, Stream } from 'stream';
import getStream from 'get-stream';
import { StorageClient, } from './StorageClient';
import { streamFromObject } from './utils';
import { TransformMiddleware, ReqWithBodyOptions, ReqOptions, ResponseType } from './interfaces';

export class ObjectStorage {
  private client: StorageClient;

  private forwards: TransformMiddleware[];

  private reverses: TransformMiddleware[];

  public constructor(config: { uri: string; jwtSecret: string }, client?: StorageClient) {
    this.client = client || new StorageClient(config);
    this.forwards = [];
    this.reverses = [];
  }

  private async applyMiddlewares(getFreshStream: () => Promise<Readable>, middlewares: TransformMiddleware[]): Promise<Readable> {
    const stream = await getFreshStream();
    return middlewares.reduce((_stream, middleware) => _stream.pipe(middleware()), stream);
  }

  private getDataByResponseType(data: Stream, responseType: ResponseType = 'stream') {
    switch (responseType) {
      case 'stream': return data;
      case 'json': return getStream(data);
      case 'arraybuffer': return getStream.buffer(data);
      default: throw new Error(`Response type "${responseType}" is not supported`);
    }
  }

  private payloadToStream(objOrFunc: object | (() => Promise<Readable>)): () => Promise<Readable> {
    if (typeof objOrFunc === 'function') {
      return objOrFunc as () => Promise<Readable>;
    }
    return streamFromObject.bind({}, objOrFunc as object);
  }

  public use(forward: TransformMiddleware, reverse: TransformMiddleware): ObjectStorage {
    this.forwards.push(forward);
    this.reverses.unshift(reverse);
    return this;
  }

  public async add(objOrFunc: object | (() => Promise<Readable>), reqWithBodyOptions?: ReqWithBodyOptions) {
    const getResultStream = async () => this.applyMiddlewares(this.payloadToStream(objOrFunc), this.forwards);
    const { data } = await this.client.post(getResultStream, reqWithBodyOptions);
    return data.objectId;
  }

  public async update(
    objectId: string, objOrFunc: object | (() => Promise<Readable>), reqWithBodyOptions?: ReqWithBodyOptions
  ) {
    const getResultStream = async () => this.applyMiddlewares(this.payloadToStream(objOrFunc), this.forwards);
    const { data } = await this.client.put(objectId, getResultStream, reqWithBodyOptions);
    return data;
  }

  public async get(objectId: string, reqOptions: ReqOptions = {}): Promise<any> {
    const getFreshStream = async () => (await this.client.get(objectId, reqOptions)).data;
    const stream = await this.applyMiddlewares(getFreshStream, this.reverses);
    return this.getDataByResponseType(stream, reqOptions.responseType);
  }

  public async getAllByParams(params: object, reqOptions: ReqOptions = {}) {
    const { data } = await this.client.get(params, reqOptions);
    return data;
  }

  public async deleteOne(objectId: string, reqOptions: ReqOptions = {}) {
    return this.client.delete(objectId, reqOptions);
  }
}
