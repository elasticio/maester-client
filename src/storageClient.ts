import axios, { AxiosInstance, AxiosResponse } from 'axios';
import http from 'http';
import https from 'https';
import log from './logger';
import { Readable } from 'stream';

interface RequestHeaders {
  [index: string]: string | number;
}

export interface JWTPayload {
  [index: string]: string;
}
export interface RequestOptions {
  maxAttempts?: number;
  delay?: number;
  onResponse?: (err: Error, res: AxiosResponse) => boolean;
}

export default class StorageClient {
  private api: AxiosInstance;
  private readonly jwtSecret: string;

  private static httpAgent = new http.Agent({ keepAlive: true });
  private static httpsAgent = new https.Agent({ keepAlive: true });

  public constructor(config: { uri: string; jwtSecret: string }) {
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

  private async requestRetry(
		request: () => Promise<AxiosResponse>,
		{ maxAttempts = 3, delay = 100, onResponse }: RequestOptions = {}
  ): Promise<AxiosResponse> {
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

  private async getHeaders(override?: RequestHeaders) {
		return { Authorization: `Bearer ${this.jwtSecret}`, ...override };
  }

  public async readStream(objectId: string, params?: object): Promise<AxiosResponse> {
		const res = await this.requestRetry(
			async (): Promise<AxiosResponse> => this.api.get(`/objects/${objectId}`, {
				responseType: 'stream',
				headers: await this.getHeaders(),
				params
			})
		);
		return res;
  }

  public async readAllByParamsAsStream(params: object): Promise<AxiosResponse> {
		const res = await this.requestRetry(
			async (): Promise<AxiosResponse> => this.api.get('/objects', {
				responseType: 'stream',
				headers: await this.getHeaders(),
				params
			})
		);
		return res;
  }

  public async writeStream(stream: () => Readable, customHeaders: object): Promise<AxiosResponse> {
		const headers: RequestHeaders = {
			'content-type': 'application/octet-stream',
			...customHeaders
		};
		const res = await this.requestRetry(
			async (): Promise<AxiosResponse> => this.api.post('/objects', stream(), {
				headers: await this.getHeaders(headers)
			})
		);
		return res;
  }

  public async deleteOne(objectId: string): Promise<AxiosResponse> {
		const res = await this.requestRetry(
			async (): Promise<AxiosResponse> => this.api.delete(`/objects/${objectId}`, {
				headers: await this.getHeaders()
			})
		);
		return res;
  }

  public async updateAsStream(objectId: string, stream: Readable): Promise<void> {
		await this.requestRetry(
			async (): Promise<AxiosResponse> => this.api.put(`/objects/${objectId}`, stream, {
				responseType: 'stream', headers: await this.getHeaders()
			})
		);
  }
}