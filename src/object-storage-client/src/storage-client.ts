import axios, { AxiosInstance, AxiosResponse } from 'axios';
import http from 'http';
import https from 'https';
import log from './logger';
import { sign } from 'jsonwebtoken';
import { promisify } from 'util';
import { Readable } from 'stream';

enum ObjectHeaders {
    ttl = 'x-eio-ttl',  
    status = 'x-query-status' // added
}

interface RequestHeaders { [index: string]: string | number }

export type BatchStatus = 'OPEN' | 'READY' | 'LOCKED' | 'FAILED' | 'SUCCESS'; // added

export interface JWTPayload { [index: string]: string };

// export interface ObjectOptions {
//     ttl: number;
// };
export interface ObjectOptions {
    ttl?: number;
    status?: BatchStatus;
};

export interface RequestOptions {
    maxAttempts?: number;
    delay?: number;
    onResponse?: (err: Error, res: AxiosResponse) => boolean;
}

export default class StorageClient {
    private api: AxiosInstance;
    private readonly jwtSecret?: string;

    private static httpAgent = new http.Agent({ keepAlive: true });
    private static httpsAgent = new https.Agent({ keepAlive: true });

    public constructor(config: { uri: string; jwtSecret?: string }) {
        this.api = axios.create({
            baseURL: `${config.uri}/`,
            httpAgent: StorageClient.httpAgent,
            httpsAgent: StorageClient.httpsAgent,
            validateStatus: null,
            maxContentLength: Infinity,
            maxRedirects: 0
        });
        this.jwtSecret = config.jwtSecret;
    }

    private async requestRetry(request: () => Promise<AxiosResponse>, { maxAttempts = 3, delay = 100, onResponse }: RequestOptions = {}): Promise<AxiosResponse> {
        let attempts = 0;
        let res;
        let err;
        while (attempts < maxAttempts) {
            err = null;
            res = null;
            attempts++;
            try {
                res = await request();
            } catch (e) {
                err = e;
            }
            if (onResponse && onResponse(err, res)) {
                continue;
            }
            // last attempt error should not be logged
            if ((err || res.status >= 400) && attempts < maxAttempts) {
                log.warn('Error during object request: %s', err || `${res.status} (${res.statusText})`);
                await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, delay));
                continue;
            }
            break;
        }
        if (err || res.status >= 400) {
            throw err || new Error(`HTTP error during object request: ${res.status} (${res.statusText})`);
        }
        return res;
    }

    private async getHeaders(jwtPayloadOrToken: JWTPayload | string, override?: RequestHeaders) {
        if (typeof jwtPayloadOrToken !== 'string' && !this.jwtSecret) {
            throw new Error('Neither JWT token passed, nor JWT secret provided during initialization');
        }
        const token = typeof jwtPayloadOrToken === 'string'
            ? jwtPayloadOrToken
            : await promisify(sign)(jwtPayloadOrToken, this.jwtSecret);
        return { Authorization: `Bearer ${token}`, ...override };
    }

    public async readStream(objectId: string, jwtPayloadOrToken?: JWTPayload | string): Promise<AxiosResponse> {
        const res = await this.requestRetry(
            // async (): Promise<AxiosResponse> => this.api.get(`/objects/${objectId}`, { responseType: 'stream', headers: await this.getHeaders(jwtPayloadOrToken) })
            async (): Promise<AxiosResponse> => this.api.get(`/objects/${objectId}`, { responseType: 'stream', headers: await this.getHeaders(jwtPayloadOrToken || this.jwtSecret) })
        );
        return res;
    }

    public async writeStream(stream: () => Readable, jwtPayloadOrToken?: JWTPayload | string, options?: ObjectOptions): Promise<AxiosResponse> {
        const headers: RequestHeaders = {
            'content-type': 'application/octet-stream'
        };
        if (options && options.ttl) {
            headers[ObjectHeaders.ttl] = options.ttl;
        }
        const res = await this.requestRetry(
            // async (): Promise<AxiosResponse> => this.api.post(`/objects`, stream(), { headers: await this.getHeaders(jwtPayloadOrToken, headers) })
            async (): Promise<AxiosResponse> => this.api.post(`/objects`, stream(), { headers: await this.getHeaders(jwtPayloadOrToken || this.jwtSecret, headers) })
        );
        return res;
    }

    public async deleteOne(objectId: string, jwtPayloadOrToken?: JWTPayload | string): Promise<AxiosResponse> {
        const res = await this.requestRetry(
            async (): Promise<AxiosResponse> => this.api.delete(`/objects/${objectId}`, { headers: await this.getHeaders(jwtPayloadOrToken) })
        );
        return res;
    }

    public async writeBatchStream(stream: () => Readable, options: ObjectOptions): Promise<AxiosResponse> {
        const headers: RequestHeaders = {
            'content-type': 'application/octet-stream'
        };
        if (options.ttl) {
            headers[ObjectHeaders.ttl] = options.ttl;
        } else if (options.status) {
            headers[ObjectHeaders.status] = options.status;
        }
        const res = await this.requestRetry(
            async (): Promise<AxiosResponse> => this.api.post('/objects', stream(), { headers: await this.getHeaders(this.jwtSecret, headers) })
        );
        return res;
    }

    public async readAllByStatusAsStream(status: string): Promise<AxiosResponse> {
        const res = await this.requestRetry(
            async (): Promise<AxiosResponse> => this.api.get('/objects', { responseType: 'stream', headers: await this.getHeaders(this.jwtSecret), params: {'query[status]': status} })
        );
        return res;
    }

    public async updateBatchStream(objectId: string, stream: () => Readable): Promise<AxiosResponse> {
        const res = await this.requestRetry(
            async (): Promise<AxiosResponse> => this.api.put(`/objects/${objectId}`, stream(), { responseType: 'stream', headers: await this.getHeaders(this.jwtSecret) })
        );
        return res;
    }

    public async updateBatchStatusById(objectId: string, status: string, stream: () => Readable): Promise<AxiosResponse> {
        const headers: RequestHeaders = {};
        headers[ObjectHeaders.status] = status;
        const res = await this.requestRetry(
            async (): Promise<AxiosResponse> => this.api.put(`/objects/${objectId}`, stream(), { headers: await this.getHeaders(this.jwtSecret, headers) })
        );
        return res;
    }
    
    public async deleteBatch(objectId: string): Promise<AxiosResponse> {
        const res = await this.requestRetry(
            async (): Promise<AxiosResponse> => this.api.delete(`/objects/${objectId}`, { headers: await this.getHeaders(this.jwtSecret) })
        );
        return res;
    }
}