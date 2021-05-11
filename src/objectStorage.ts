import { Readable, Duplex } from 'stream';
import getStream from 'get-stream';
import StorageClient, { JWTPayload, ObjectOptions } from './storageClient';

export interface ObjectDTO {
  stream?: Readable;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  headers: any;
}

export type TransformMiddleware = () => Duplex;

export default class ObjectStorage {
  private client: StorageClient;
  private forwards: TransformMiddleware[];
  private reverses: TransformMiddleware[];

  public constructor(config: { uri: string; jwtSecret?: string }, client?: StorageClient) {
    this.client = client || new StorageClient(config);
    this.forwards = [];
    this.reverses = [];
  }

  public use(forward: TransformMiddleware, reverse: TransformMiddleware): ObjectStorage {
    this.forwards.push(forward);
    this.reverses.unshift(reverse);
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async getAsJSON(objectId: string, jwtPayloadOrToken?: JWTPayload | string): Promise<any> {
    const objectDTO = await this.getAsStream(objectId, jwtPayloadOrToken);
    const data = await getStream(objectDTO.stream);
    return JSON.parse(data);
  }

  public async getAsStream(objectId: string, jwtPayloadOrToken?: JWTPayload | string, params?: any): Promise<ObjectDTO> {
    const res = await this.client.readStream(objectId, jwtPayloadOrToken, params);
    const resultStream = this.applyMiddlewares(res.data, this.reverses);
    return { stream: resultStream, headers: res.headers };
  }

  public async deleteOne(objectId: string, jwtPayloadOrToken?: JWTPayload | string): Promise<void> {
    await this.client.deleteOne(objectId, jwtPayloadOrToken);
  }

  public async addAsStream(stream: () => Readable, jwtPayloadOrToken?: JWTPayload | string, options?: ObjectOptions): Promise<string> {
    const resultStream = () => {
      return this.applyMiddlewares(stream(), this.forwards);
    };
    const res = await this.client.writeStream(resultStream, jwtPayloadOrToken, options);
    return res.data.objectId;
  }

  private applyMiddlewares(stream: Readable, middlewares: TransformMiddleware[]): Readable {
    return middlewares.reduce((stream, middleware) => {
      return stream.pipe(middleware());
    }, stream);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async addAsJSON(data: any, jwtPayloadOrToken: JWTPayload | string, options?: ObjectOptions): Promise<string> {
    const dataStream = () => {
      const dataString = JSON.stringify(data);
      const stream = new Readable();
      stream.push(dataString);
      stream.push(null);
      return stream;
    };
    return this.addAsStream(dataStream, jwtPayloadOrToken, options);
  }
}
