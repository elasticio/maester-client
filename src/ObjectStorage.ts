/* eslint-disable class-methods-use-this */
import { Readable, Duplex, Stream } from 'stream';
import { AxiosRequestConfig } from 'axios';
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

  private static getDataByResponseType(data: Stream, responseType: ResponseType = 'stream') {
    switch (responseType) {
      case 'stream': return data;
      case 'json': return getStream(data);
      case 'arraybuffer': return getStream.buffer(data);
      default: throw new Error(`Response type "${responseType}" is not supported`);
    }
  }

  public use(forward: TransformMiddleware, reverse: TransformMiddleware): ObjectStorage {
    this.forwards.push(forward);
    this.reverses.unshift(reverse);
    return this;
  }

  public async addAsStream(getFreshStream: () => Promise<Readable>, reqWithBodyOptions?: ReqWithBodyOptions) {
    const getResultStream = async () => this.applyMiddlewares(getFreshStream, this.forwards);
    const { data } = await this.client.post(getResultStream, reqWithBodyOptions);
    return data.objectId;
  }

  public async addAsJSON(data: object, reqWithBodyOptions?: ReqWithBodyOptions) {
    const getResultStream = async () => this.applyMiddlewares(streamFromObject.bind({}, data), this.forwards);
    const res = await this.client.post(getResultStream, reqWithBodyOptions);
    return res.data.objectId;
  }

  public async putAsStream(
    objectId: string, getFreshStream: () => Promise<Readable>, reqWithBodyOptions?: ReqWithBodyOptions
  ) {
    const getResultStream = async () => this.applyMiddlewares(getFreshStream, this.forwards);
    const { data } = await this.client.put(objectId, getResultStream, reqWithBodyOptions);
    return data;
  }

  public async putAsJSON(
    objectId: string, data: object, reqWithBodyOptions?: ReqWithBodyOptions
  ) {
    const getResultStream = async () => this.applyMiddlewares(streamFromObject.bind({}, data), this.forwards);
    const res = await this.client.put(objectId, getResultStream, reqWithBodyOptions);
    return res.data;
  }

  public async put(
    objectId: string, dataOrFunc: object | (() => Promise<Readable>), reqWithBodyOptions?: ReqWithBodyOptions
  ) {
    let getFreshStream;
    if (typeof dataOrFunc === 'function') {
      getFreshStream = dataOrFunc as () => Promise<Readable>;
    } else {
      getFreshStream = streamFromObject.bind({}, dataOrFunc as object);
    }
    const getResultStream = async () => this.applyMiddlewares(getFreshStream, this.forwards);
    const { data } = await this.client.put(objectId, getResultStream, reqWithBodyOptions);
    return data;
  }

  public async get(objectId: string, reqOptions: ReqOptions = {}): Promise<any> {
    const getFreshStream = async () => (await this.client.get(objectId, reqOptions)).data;
    const stream = await this.applyMiddlewares(getFreshStream, this.reverses);
    return ObjectStorage.getDataByResponseType(stream, reqOptions.responseType);
  }

  public async getAllByParams(params: object, reqOptions: ReqOptions = {}) {
    const { data } = await this.client.get(params, reqOptions);
    return data;
  }

  public async deleteOne(objectId: string, reqOptions: ReqOptions = {}) {
    return this.client.delete(objectId, reqOptions);
  }
}
