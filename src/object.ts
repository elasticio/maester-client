import Stream from 'stream';
import FormData from 'form-data';
import { AxiosInstance, AxiosResponse, ResponseType } from 'axios';

export const USER_META_HEADER_PREFIX = 'x-meta-';
export const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

export type PlainOrArray<T> = T | T[];
export type ObjectMetadata = Record<string, any>;

export interface ObjectData {
    data: string | Buffer | Stream;
    contentType?: 'string';
}

export function isObjectData(data: any): data is ObjectData {
    return typeof data === 'object' && 'data' in data;
}

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

    public create(data: PlainOrArray<string | Buffer | Stream | ObjectData>,
                  params?: CreateObjectParams): Promise<PlainOrArray<CreateObjectResponse>> {
        const { bucket, metadata } = params ?? {};

        const dataArray = Array.isArray(data) ? data : [data];
        const formData = new FormData();

        for (const item of dataArray) {
            const [data, contentType] = isObjectData(item)
                ? [item.data, item.contentType]
                : [item, DEFAULT_CONTENT_TYPE];

            formData.append('data', data, { contentType });
        }

        if (bucket) {
            formData.append('bucket', bucket);
        }

        if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
                formData.append(key, value);
            }
        }

        const headers = {
            'content-type': `multipart/form-data; boundary=${formData.getBoundary()}`
        };

        return this.client.post('/objects', formData, { headers })
            .then((res: AxiosResponse) => Array.isArray(res.data)
                ? res.data.map(data => new CreateObjectResponse(data))
                : new CreateObjectResponse(res.data));
    }

    public delete(id: string): Promise<void> {
        return this.client.delete(`/objects/${id}`);
    }
}
