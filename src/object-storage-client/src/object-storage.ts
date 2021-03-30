import { Readable, Duplex } from 'stream';
import getStream from 'get-stream';
import StorageClient, { JWTPayload, ObjectOptions } from './storage-client';
import { AxiosResponse } from 'axios';

export interface ObjectDTO {
    stream: Readable;
    headers: any;
};

// seems, I should add batch-component and import it from there
interface idk {
    objectId: string;
}

export type TransformMiddleware = () => Duplex;

export default class ObjectStorage {
    private readonly client: StorageClient;
    private readonly forwards: TransformMiddleware[];
    private readonly reverses: TransformMiddleware[];

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

    /**
     NEW METHODS FOR BATCH
    */

    public async createAllBatches(batches: any[], jwtPayloadOrToken?: JWTPayload | string): Promise<any> {
        const batachesList: Array<Promise<AxiosResponse>> = [];
        batches.forEach(batch => {
            const { status } = batch;
            delete batch.status;
            const dataStream = this.formStream(batch);

            const resultStream = () => {
                return this.applyMiddlewares(dataStream, this.forwards);
            };

            batachesList.push(this.client.writeBatchStream(resultStream, { status }, jwtPayloadOrToken));
        });

        return Promise.all(batachesList);
    }

    public async getAllBatachesInStatus(status: string, jwtPayloadOrToken?: JWTPayload | string): Promise<idk[]> {
        const res = await this.client.getAllByStatusAsStream(status, jwtPayloadOrToken);
        const resultStream = this.applyMiddlewares(res.data, this.reverses);
        const data = await getStream(resultStream);
        return JSON.parse(data);
    }

    public async getAndLockBatches(jwtPayloadOrToken?: JWTPayload | string): Promise<any> {
        const batachesList: any[] = [];
        const batchesRaw = await this.getAllBatachesInStatus('READY', jwtPayloadOrToken);
        const ids = batchesRaw.map(({ objectId }) => objectId);
        ids.forEach(id => batachesList.push(this.updateBatchStatusById(id, 'LOCKED', jwtPayloadOrToken)));
        return Promise.all(batachesList);
    }

    public async updateBatch(objectId: string, data: any, jwtPayloadOrToken?: JWTPayload | string): Promise<number> {
        const dataStream = this.formStream(data);
        return this.updateAsStream(objectId, dataStream, jwtPayloadOrToken);
    }

    public async updateAsStream(objectId: string, stream: Readable, jwtPayloadOrToken?: JWTPayload | string): Promise<number> {
        const resultStream = () => {
            return this.applyMiddlewares(stream, this.forwards);
        };
        try {
            await this.client.updateBatchStream(objectId, resultStream, jwtPayloadOrToken);
            return 1;
        } catch (err) {
            console.log(err)
            return 0;
        }
    }

    public async updateBatchStatusById(objectId: string, status: string, jwtPayloadOrToken?: JWTPayload | string): Promise<any> {
        const dataStream = this.formStream('');
        const resultStream = () => {
            return this.applyMiddlewares(dataStream, this.forwards);
        };
        return this.client.updateBatchStatusById(objectId, status, resultStream, jwtPayloadOrToken);
    }

    /**
     * Need fix
     */
    public async isBatchExist(objectId: string, jwtPayloadOrToken?: JWTPayload | string): Promise<boolean> {
        try {
            const objectDTO = await this.getAsStream(objectId, jwtPayloadOrToken);
            const data = await getStream(objectDTO.stream);
            return !!data;
        } catch (err) {
            console.log(err)
            return false;
        }
    }

    public async deleteAllBatches(ids: string[], jwtPayloadOrToken?: JWTPayload | string): Promise<number> {
        const batachesList: any[] = [];
        ids.forEach(id => batachesList.push(this.client.deleteBatch(id, jwtPayloadOrToken)))
        const deleted = await Promise.all(batachesList);
        return deleted.length;
    }

    public async deleteAllWithStatus(status: string, jwtPayloadOrToken?: JWTPayload | string): Promise<number> {
        const batachesList: any[] = [];
        const batchesRaw = await this.getAllBatachesInStatus(status, jwtPayloadOrToken);
        const ids = batchesRaw.map(({ objectId }) => objectId);
        ids.forEach(id => batachesList.push(this.client.deleteBatch(id, jwtPayloadOrToken)))
        const deleted = await Promise.all(batachesList);
        return deleted.length;
    }

    private formStream(data: any) {
        if (typeof data !== 'string') {
            data = JSON.stringify(data);
        }
        const dataString = JSON.stringify(data);
        const stream = new Readable();
        stream.push(dataString);
        stream.push(null);
        return stream;
    }
}
