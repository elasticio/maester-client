/* eslint-disable class-methods-use-this */
import { Readable, Duplex, Stream } from 'stream';
import { AxiosRequestConfig } from 'axios';
import getStream from 'get-stream';
import { StorageClient, } from './StorageClient';
import { TransformMiddleware, ReqWithBodyOptions, ReqOptions } from './interfaces';

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

  public use(forward: TransformMiddleware, reverse: TransformMiddleware): ObjectStorage {
    this.forwards.push(forward);
    this.reverses.unshift(reverse);
    return this;
  }

  public async addAsStream(getFreshStream: () => Promise<Readable>, reqWithBodyOptions?: ReqWithBodyOptions) {
    const getResultStream = async () => this.applyMiddlewares(getFreshStream, this.forwards);
    const res = await this.client.post(getResultStream, reqWithBodyOptions);
    return res.data.objectId;
  }

  // public async getAsStream(objectId: string, reqOptions?: ReqOptions) {
  //   const res = async () => this.client.get(objectId, reqOptions);
  //   const resultStream = this.applyMiddlewares(res.data, this.reverses);
  //   return { stream: resultStream, headers: res.headers };
  // }

  // private formStream(data: object): Readable {
  //   const dataString = JSON.stringify(data);
  //   const stream = new Readable();
  //   stream.push(dataString);
  //   stream.push(null);
  //   return stream;
  // }

  // public use(forward: TransformMiddleware, reverse: TransformMiddleware): ObjectStorage {
  //   this.forwards.push(forward);
  //   this.reverses.unshift(reverse);
  //   return this;
  // }

  // public async getById(objectId: string, responseType: ResponseType = DEFAULT_RESPONSE_TYPE): Promise<any> {
  //   const { data } = await this.client.readStream(objectId);
  //   const stream = this.applyMiddlewares(data, this.reverses);
  //   return ObjectStorage.getDataByResponseType(stream, responseType);
  // }

  // public async getAllByParams(params: object): Promise<string> {
  //   const res = await this.client.readAllByParamsAsStream(params);
  //   return res.data;
  // }

  // public async deleteOne(objectId: string): Promise<any> {
  //   return this.client.deleteOne(objectId);
  // }

  // public async deleteMany(params: object): Promise<any> {
  //   return this.client.deleteMany(params);
  // }

  // public async postObject(data: object, headers: object): Promise<string> {
  //   const resultStream = () => this.applyMiddlewares(this.formStream(data), this.forwards);
  //   const res = await this.client.writeStream(resultStream, headers);
  //   return res.data;
  // }

  // public async updateOne(objectId: string, data: object, headers?: object): Promise<string> {
  //   const resultStream = () => this.applyMiddlewares(this.formStream(data), this.forwards);
  //   const res = await this.client.updateAsStream(objectId, resultStream, headers);
  //   return res.data;
  // }

  // private static getDataByResponseType(data: Stream, responseType: ResponseType) {
  //   switch (responseType) {
  //     case 'stream': return data;
  //     case 'json': return getStream(data);
  //     case 'arraybuffer': return getStream.buffer(data);
  //     default: throw new Error(`Response type "${responseType}" is not supported`);
  //   }
  // }
}
