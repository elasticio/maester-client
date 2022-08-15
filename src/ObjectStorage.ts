/* eslint-disable class-methods-use-this */
import { Readable, Stream } from 'stream';
import getStream from 'get-stream';
import { StorageClient, } from './StorageClient';
import { parseJson, streamFromData, getFreshStreamChecker } from './utils';
import { TransformMiddleware, ReqWithBodyOptions, ReqOptions, ResponseType, uploadData } from './interfaces';

export class ObjectStorage {
  private client: StorageClient;

  private forwards: TransformMiddleware[];

  private reverses: TransformMiddleware[];

  public constructor(config: { uri: string; jwtSecret?: string, userAgent?: string }, client?: StorageClient) {
    this.client = client || new StorageClient(config);
    this.forwards = [];
    this.reverses = [];
  }

  private async applyMiddlewares(getFreshStream: () => Promise<Readable>, middlewares: TransformMiddleware[]): Promise<Readable> {
    const stream = await getFreshStream();
    return middlewares.reduce((_stream, middleware) => _stream.pipe(middleware()), stream);
  }

  private async getDataByResponseType(data: Stream, responseType: ResponseType = 'json') {
    switch (responseType) {
      case 'stream': return data;
      case 'json': {
        const asJSON = await getStream(data);
        return parseJson(asJSON);
      }
      case 'arraybuffer': return getStream.buffer(data);
      default: throw new Error(`Response type "${responseType}" is not supported`);
    }
  }

  private payloadToStream(dataOrFunc: uploadData | (() => Promise<Readable>)): () => Promise<Readable> {
    if (typeof dataOrFunc === 'function') {
      return dataOrFunc as () => Promise<Readable>;
    }
    return streamFromData.bind({}, dataOrFunc as uploadData);
  }

  private async formStreamGetter(dataOrFunc: uploadData | (() => Promise<Readable>)): Promise<() => Promise<Readable>> {
    const checkFreshStream = getFreshStreamChecker();
    return async () => {
      const getFreshStream = this.payloadToStream(dataOrFunc);
      const stream = await getFreshStream();
      checkFreshStream(stream);
      return this.applyMiddlewares(getFreshStream, this.forwards);
    };
  }

  public use(forward: TransformMiddleware, reverse: TransformMiddleware): ObjectStorage {
    this.forwards.push(forward);
    this.reverses.unshift(reverse);
    return this;
  }

  /**
   * @param dataOrFunc async function returning stream OR any data (except 'undefined')
   */
  public async add(dataOrFunc: uploadData | (() => Promise<Readable>), reqWithBodyOptions?: ReqWithBodyOptions) {
    const { data } = await this.client.post(await this.formStreamGetter(dataOrFunc), reqWithBodyOptions);
    return data.objectId;
  }

  /**
   * @param dataOrFunc async function returning stream OR any data (except 'undefined')
   */
  public async update(
    objectId: string, dataOrFunc: uploadData | (() => Promise<Readable>), reqWithBodyOptions?: ReqWithBodyOptions
  ) {
    const { data } = await this.client.put(objectId, await this.formStreamGetter(dataOrFunc), reqWithBodyOptions);
    return data;
  }

  public async getOne(objectId: string, reqOptions: ReqOptions = {}): Promise<any> {
    const getResultStream = async () => (await this.client.get(objectId, reqOptions)).data;
    const stream = await this.applyMiddlewares(getResultStream, this.reverses);
    return this.getDataByResponseType(stream, reqOptions.responseType);
  }

  public async getAllByParams(params: object, reqOptions: ReqOptions = {}): Promise<any> {
    const getResultStream = async () => (await this.client.get(params, reqOptions)).data;
    const stream = await this.applyMiddlewares(getResultStream, this.reverses);
    return this.getDataByResponseType(stream, reqOptions.responseType);
  }

  public async getHeaders(objectId: string, reqOptions: ReqOptions = {}) {
    const { headers } = await this.client.get(objectId, reqOptions);
    return headers;
  }

  public async deleteOne(objectId: string, reqOptions: ReqOptions = {}) {
    return this.client.delete(objectId, reqOptions);
  }

  public async deleteAllByParams(params: object, reqOptions: ReqOptions = {}) {
    return this.client.delete(params, reqOptions);
  }
}
