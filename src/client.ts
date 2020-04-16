import qs from 'qs';
import axios, { AxiosInstance } from 'axios';

import pkg from '../package.json';
import BucketRepository from './bucket';
import ObjectRepository from './object';

export class Client {
    private readonly client: AxiosInstance;
    public readonly version = pkg.version;

    public readonly baseUri: string;
    public readonly token: string;

    public readonly buckets: BucketRepository;
    public readonly objects: ObjectRepository;

    constructor(baseUri: string, token: string) {
        this.baseUri = baseUri;
        this.token = token;

        this.client = axios.create({
            baseURL: this.baseUri,
            paramsSerializer: params => qs.stringify(params),
            headers: {
                Authorization: `Bearer ${this.token}`,
                'User-Agent': `maester-client/${this.version}`
            }
        });
        this.buckets = new BucketRepository(this.client);
        this.objects = new ObjectRepository(this.client);
    }
}
