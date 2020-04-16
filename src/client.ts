import qs from 'qs';
import { sign } from 'jsonwebtoken';
import axios, { AxiosInstance } from 'axios';

import pkg from '../package.json';
import BucketRepository from './bucket';
import ObjectRepository from './object';

export interface JwtPayload {
    tenantId: string;
    contractId: string;
    workspaceId: string;
    flowId: string;
    userId: string;
}

export class Client {
    private readonly client: AxiosInstance;
    public readonly version = pkg.version;

    public readonly buckets: BucketRepository;
    public readonly objects: ObjectRepository;

    constructor(baseUri: string) {
        this.client = axios.create({
            baseURL: baseUri,
            paramsSerializer: params => qs.stringify(params),
            headers: {
                'User-Agent': `maester-client/${this.version}`
            }
        });
        this.buckets = new BucketRepository(this.client);
        this.objects = new ObjectRepository(this.client);
    }

    public sign(jwtPayload: JwtPayload, jwtSecret: string): Client {
        const jwtToken = sign(jwtPayload, jwtSecret);
        this.client.defaults.headers.common.authorization = `Bearer ${jwtToken}`;
        return this;
    }
}
