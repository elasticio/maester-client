import Stream from 'stream';
import FormData from 'form-data';
import { AxiosInstance, AxiosResponse, ResponseType } from 'axios';

export const USER_META_HEADER_PREFIX = 'x-meta-';

export type ObjectMetadata = Record<string, any>;

export function metaToHeaders(meta: ObjectMetadata): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(meta)) {
        headers[`${USER_META_HEADER_PREFIX}${key}`] = String(value);
    }
    return headers;
}

export function headersToMeta(headers: Record<string, string>): ObjectMetadata {
    const meta: ObjectMetadata = {};
    for (const [key, value] of Object.entries(headers)) {
        if (key.indexOf(USER_META_HEADER_PREFIX) === 0) {
            meta[key.substr(USER_META_HEADER_PREFIX.length)] = value;
        }
    }
    return meta;
}

export class GetObjectResponse {
    public readonly contentType: string;
    public readonly contentLength: number;
    public readonly metadata: ObjectMetadata;
    public readonly data: any;

    constructor(res: AxiosResponse) {
        const { headers, data } = res;
        this.contentType = headers['content-type'] ?? '';
        this.contentLength = parseInt(headers['content-length'] ?? 0);
        this.metadata = headersToMeta(headers);
        this.data = data;
    }
}

export interface CreateObjectParams {
    contentType?: string;
    bucket?: string;
    metadata?: ObjectMetadata;
}

export class CreateObjectResponse {
    public readonly id: string;
    public readonly contentType: string;
    public readonly contentLength: number;
    public readonly md5: string;
    public readonly createdAt: Date;
    public readonly metadata: ObjectMetadata;

    constructor(data: any) {
        const { objectId, contentType, contentLength, md5, createdAt, metadata } = data;
        this.id = objectId ?? '';
        this.contentType = contentType ?? '';
        this.contentLength = contentLength ?? 0;
        this.md5 = md5 ?? '';
        this.createdAt = new Date(createdAt);
        this.metadata = metadata ?? {};
    }
}

export default class ObjectRepository {
    private readonly client: AxiosInstance;

    constructor(client: AxiosInstance) {
        this.client = client;
    }

    public get(id: string, responseType?: ResponseType): Promise<GetObjectResponse> {
        return this.client.get(`/objects/${id}`, { responseType })
            .then((res: AxiosResponse) => new GetObjectResponse(res));
    }

    public create(data: string | Buffer | FormData | Stream,
                  params?: CreateObjectParams): Promise<CreateObjectResponse | CreateObjectResponse[]> {
        const { contentType, bucket, metadata } = params ?? {};
        const userMetadata = metadata ?? {};

        if (bucket) {
            if (data instanceof FormData) {
                data.append('bucket', bucket);
            } else {
                userMetadata.bucket = bucket;
            }
        }

        const headers = {
            ...metaToHeaders(userMetadata)
        };

        headers['content-type'] = data instanceof FormData
            ? `multipart/form-data; boundary=${data.getBoundary()}`
            : contentType ?? 'application/octet-stream';

        return this.client.post('/objects', data, { headers })
            .then((res: AxiosResponse) => Array.isArray(res.data)
                ? res.data.map(data => new CreateObjectResponse(data))
                : new CreateObjectResponse(res.data));
    }

    public delete(id: string): Promise<void> {
        return this.client.delete(`/objects/${id}`);
    }
}
