import { Readable, Duplex } from 'stream';
import getStream from 'get-stream';
import StorageClient, { JWTPayload, ObjectOptions, BatchStatus } from './storage-client';

export interface ObjectDTO {
    stream?: Readable;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headers: any;
};

export type TransformMiddleware = () => Duplex;

export default class ObjectStorage {
    private client: StorageClient;
    private forwards: TransformMiddleware[];
    private reverses: TransformMiddleware[];

    public constructor(config: {uri: string; jwtSecret?: string }) {
        this.client = new StorageClient({ uri: config.uri, jwtSecret: config.jwtSecret });
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

    public async getAsStream(objectId: string, jwtPayloadOrToken?: JWTPayload | string): Promise<ObjectDTO> {
        const res = await this.client.readStream(objectId, jwtPayloadOrToken);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async addBatch(data: any, status: BatchStatus): Promise<string> {
        const dataStream = () => {
            const dataString = JSON.stringify(data);
            const stream = new Readable();
            stream.push(dataString);
            stream.push(null);
            return stream;
        };
        return this.addBatchAsStream(dataStream, { status });
    }

    public async addBatchAsStream(stream: () => Readable, options: ObjectOptions): Promise<string> {
        const resultStream = () => {
            return this.applyMiddlewares(stream(), this.forwards);
        };
        const res = await this.client.writeBatchStream(resultStream, options);
        return res.data.objectId;
    }

    public async getAllBatachesInStatus(status: string): Promise<any> {
        const res = await this.client.readAllByStatusAsStream(status);
        const resultStream = this.applyMiddlewares(res.data, this.reverses);
        const data = await getStream(resultStream);
        return JSON.parse(data);
    }

    public async updateBatch(objectId: string, data: any): Promise<number> {
        const dataStream = () => {
            const dataString = JSON.stringify(data);
            const stream = new Readable();
            stream.push(dataString);
            stream.push(null);
            return stream;
        };
        return this.updateAsStream(objectId, dataStream);
    }

    public async updateAsStream(objectId: string, stream: () => Readable): Promise<number> {
        const resultStream = () => {
            return this.applyMiddlewares(stream(), this.forwards);
        };
        try {
            await this.client.updateBatchStream(objectId, resultStream);
            return 1;
        } catch(err){
            console.log(err)
            return 0;
        }
    }

    public async updateBatchStatusById(objectId: string, status: string): Promise<any> {
        const dataStream = () => {
            const stream = new Readable();
            stream.push("");
            stream.push(null);
            return stream;
        };
        const resultStream = () => {
            return this.applyMiddlewares(dataStream(), this.forwards);
        };
        return this.client.updateBatchStatusById(objectId, status, resultStream);
    }

    public async isBatchExist(objectId: string): Promise<boolean> {
        try {
            const objectDTO = await this.getAsStream(objectId);
            const data = await getStream(objectDTO.stream);
            return !!data;
        } catch(err){
            console.log(err)
            return false
        }
    }
    
    public async deleteBatch(objectId: string): Promise<boolean> {
        try {
            await this.client.deleteBatch(objectId);
            return true;
        } catch(err){
            console.log(err);
            return false;
        }
    }
}
