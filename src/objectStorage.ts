import { Readable, Duplex } from 'stream';
import getStream from 'get-stream';
import StorageClient, { JWTPayload } from './storageClient';

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

  private applyMiddlewares(stream: Readable, middlewares: TransformMiddleware[]): Readable {
      return middlewares.reduce((stream, middleware) => {
          return stream.pipe(middleware());
      }, stream);
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

  public async getById(objectId: string, jwtPayloadOrToken?: JWTPayload | string): Promise<object> {
      const { data } = await this.client.readStream(objectId, jwtPayloadOrToken);
      const stream = this.applyMiddlewares(data, this.reverses);
      const result = await getStream(stream);
      return JSON.parse(result);
  }

  public async getAllByParams(params: object, jwtPayloadOrToken?: JWTPayload | string): Promise<object> {
      const { data } = await this.client.readAllByParamsAsStream(params, jwtPayloadOrToken);
      const stream = this.applyMiddlewares(data, this.reverses);
      const result = await getStream(stream);
      return JSON.parse(result);
  }

  public async deleteOne(objectId: string, jwtPayloadOrToken?: JWTPayload | string): Promise<void> {
      await this.client.deleteOne(objectId, jwtPayloadOrToken);
  }

  public async addAsStream(
      stream: Readable,
      headers: object,
      jwtPayloadOrToken?: JWTPayload | string,
  ): Promise<string> {
      const resultStream = () => {
          return this.applyMiddlewares(stream, this.forwards);
      };
      const res = await this.client.writeStream(resultStream, headers, jwtPayloadOrToken);
      return res.data.objectId;
  }

  public async updateOne(objectId: string, data: object, jwtPayloadOrToken?: JWTPayload | string): Promise<void> {
      const dataStream = this.formStream(data);
      const resultStream = this.applyMiddlewares(dataStream, this.forwards);
      await this.client.updateAsStream(objectId, resultStream, jwtPayloadOrToken);
  }
}
