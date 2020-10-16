import FormData from 'form-data';
import { Readable, Writable, PassThrough } from 'stream';
import { AxiosInstance, AxiosResponse, ResponseType } from 'axios';

export const USER_META_HEADER_PREFIX = 'x-meta-';
export const USER_QUERY_HEADER_PREFIX = 'x-query-';
export const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

export type PlainOrArray<T> = T | T[];
export type ObjectMetadata = Record<string, any>;
export type QueriableField = Record<string, any>;

export interface ObjectData {
    data: string | Buffer | Readable;
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

export function headersToQuery(headers: Record<string, string>): ObjectMetadata {
    const meta: ObjectMetadata = {};
    for (const [key, value] of Object.entries(headers)) {
        if (key.indexOf(USER_QUERY_HEADER_PREFIX) === 0) {
            meta[key.substr(USER_QUERY_HEADER_PREFIX.length)] = value;
        }
    }
    return meta;
}

export class GetObjectResponse {
    public readonly data: object | string | Buffer | Readable;
    public readonly contentType?: string;
    public readonly contentLength?: number;
    public readonly metadata?: ObjectMetadata;
    public readonly queriableFields?: QueriableField;

    constructor(res: AxiosResponse) {
        const { headers, data } = res;
        this.data = data;
        if (headers['content-type']) {
            this.contentType = headers['content-type'];
        }
        if (headers['content-length']) {
            this.contentLength = parseInt(headers['content-length']);
        }
        const metadata: ObjectMetadata = headersToMeta(headers);
        if (Object.keys(metadata).length !== 0) {
            this.metadata = metadata;
        }
        const queriableFields = headersToQuery(headers);
        if (Object.keys(queriableFields).length !== 0) {
            this.queriableFields = queriableFields;
        }
    }
}

export interface ObjectQueryRequest {
    [key: string]: string;
}

export interface GetObjectQueryResponse {
    objectId: string;
    contentType: string;
    createdAt: string;
    metadata: ObjectMetadata;
    queriableFields: QueriableField;
}

interface ObjectField {
    Meta: string;
    Query: string;
}

interface ObjectFields {
    [key: string]: ObjectField;
}

export interface CreateObjectParams {
    contentType?: string;
    metadata?: ObjectMetadata;
    objectFields?: ObjectFields;
}

export interface CreateObjectResponseData {
    objectId?: string;
    contentType?: string;
    contentLength?: number;
    md5?: string;
    createdAt?: string;
    metadata?: ObjectMetadata;
}

export class CreateObjectResponse {
    public readonly id: string;
    public readonly contentType: string;
    public readonly contentLength?: number;
    public readonly md5?: string;
    public readonly createdAt: Date | null;
    public readonly metadata: ObjectMetadata;

    constructor(data: CreateObjectResponseData) {
        const { objectId, contentType, contentLength, md5, createdAt, metadata } = data;
        this.id = objectId ?? '';
        this.contentType = contentType ?? '';
        if (contentLength) {
            this.contentLength = contentLength;
        }
        if (md5) {
            this.md5 = md5;
        }
        this.createdAt = createdAt ? new Date(createdAt) : null;
        this.metadata = metadata ?? {};
    }
}

export interface PutObjectParams {
    id?: string;
    objectFields?: ObjectFields;
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

    public getBuffer(id: string): Promise<GetObjectResponse> {
        return this.get(id, 'arraybuffer');
    }

    public getStream(id: string): Promise<GetObjectResponse> {
        return this.get(id, 'stream');
    }

    public createReadStream(id: string): Readable {
        const pass = new PassThrough();
        this.getStream(id)
            .then(res => (res.data as Readable).pipe(pass))
            .catch(err => pass.destroy(err));
        return pass;
    }

    public create(data: PlainOrArray<string | Buffer | Readable | ObjectData>,
                  params?: CreateObjectParams): Promise<PlainOrArray<CreateObjectResponse>> {
        const { metadata } = params ?? {};

        const dataArray = Array.isArray(data) ? data : [data];
        const formData = new FormData();

        for (const item of dataArray) {
            const [data, contentType] = isObjectData(item)
                ? [item.data, item.contentType]
                : [item, DEFAULT_CONTENT_TYPE];

            formData.append('data', data, { contentType });
        }

        if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
                formData.append(key, value);
            }
        }

        const headers: any = {
            'content-type': `multipart/form-data; boundary=${formData.getBoundary()}`
        };

        if (params?.objectFields) {
            Object.entries(params.objectFields).forEach(e => {
                if (e[1].Query) headers[`X-Query-${e[0]}`] = e[1].Query;
                if (e[1].Meta) headers[`X-Meta-${e[0]}`] = e[1].Meta;
            })
        }

        return this.client.post('/objects', formData, { headers })
            .then((res: AxiosResponse) => Array.isArray(res.data)
                ? res.data.map(data => new CreateObjectResponse(data))
                : new CreateObjectResponse(res.data));
    }

    public createWriteStream(params?: CreateObjectParams): Writable {
        const stream = new PassThrough();
        this.create(stream, params).catch(err => stream.destroy(err));
        return stream;
    }

    public getObjectQuery(query: ObjectQueryRequest, responseType?: ResponseType): Promise<GetObjectQueryResponse[]> {
        const queryString = Object.entries(query)
            .map(e => `query[${encodeURIComponent(e[0])}]=${encodeURIComponent(e[1])}`)
            .reduce((q1, q2) => `${q1}&${q2}`);
        return this.client.get(`/objects?${queryString}`, { responseType })
            .then(res => res.data);
    }

    public async updateObjectQuery(data: PlainOrArray<string | Buffer | Readable | ObjectData>,
                                   params?: PutObjectParams): Promise<void> {
        const { id } = params ?? {};

        const dataArray = Array.isArray(data) ? data : [data];
        const formData = new FormData();

        for (const item of dataArray) {
            const [data, contentType] = isObjectData(item)
                ? [item.data, item.contentType]
                : [item, DEFAULT_CONTENT_TYPE];

            formData.append('data', data, { contentType });
        }

        const headers: any = {
            'content-type': 'application/octet-stream'
        };

        if (params?.objectFields) {
            Object.entries(params.objectFields).forEach(e => {
                if (e[1].Query) headers[`X-Query-${e[0]}`] = e[1].Query;
                if (e[1].Meta) headers[`X-Meta-${e[0]}`] = e[1].Meta;
            })
        }

        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        return this.client.put(`/objects/${id}`, data, { headers })
            .then(res => res.data);
    }

    public delete(id: string): Promise<void> {
        return this.client.delete(`/objects/${id}`);
    }

    public deleteQuery(queryFields: ObjectQueryRequest): Promise<void> {
        const queryString = Object.entries(queryFields)
            .map(e => `query[${encodeURIComponent(e[0])}]=${encodeURIComponent(e[1])}`)
            .reduce((q1, q2) => `${q1}&${q2}`);
        return this.client.delete(`/objects?${queryString}`);
    }
}
