import { AxiosInstance, AxiosResponse } from 'axios';

export class Bucket {
    public readonly id: string;
    public readonly objects: string[];
    public readonly externalId: string | null;
    public readonly closed: boolean;
    public readonly createdAt: Date;

    constructor(data: any) {
        const { id, objects, externalId, closed, createdAt } = data;
        this.id = id ?? '';
        this.objects = objects ?? [];
        this.externalId = externalId ?? null;
        this.closed = closed ?? false;
        this.createdAt = new Date(createdAt);
    }
}

export interface BucketList {
    data: Bucket[];
    meta: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    };
}

export interface ListBucketsParams {
    externalId?: string;
    page?: {
        number?: number;
        size?: number;
    };
}

export interface CreateBucketData {
    objects: string[];
    externalId?: string;
}

export interface UpdateBucketData {
    objects?: string[];
    externalId?: string | null;
    closed?: boolean;
}

export default class BucketRepository {
    private readonly client: AxiosInstance;

    constructor(client: AxiosInstance) {
        this.client = client;
    }

    public get(id: string): Promise<Bucket> {
        return this.client.get(`/buckets/${id}`)
            .then((res: AxiosResponse) => new Bucket(res.data));
    }

    public list(params?: ListBucketsParams): Promise<BucketList> {
        return this.client.get('/buckets', { params })
            .then((response: AxiosResponse) => ({
                data: response.data.data.map((bucket: any) => new Bucket(bucket)),
                meta: response.data.meta
            }));
    }

    public create(data: CreateBucketData): Promise<Bucket> {
        return this.client.post('/buckets', data)
            .then((res: AxiosResponse) => new Bucket(res.data));
    }

    public update(id: string, data: UpdateBucketData): Promise<Bucket> {
        return this.client.patch(`/buckets/${id}`, data)
            .then((res: AxiosResponse) => new Bucket(res.data));
    }

    public delete(id: string): Promise<void> {
        return this.client.delete(`/buckets/${id}`);
    }
}
