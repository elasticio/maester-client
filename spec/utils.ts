import { randomBytes } from 'crypto';
import { sign } from 'jsonwebtoken';

import { Client } from '../src';

export const baseUri = 'http://127.0.0.1';

export const jwtPayload = {
    tenantId: 'tenant-id',
    contractId: 'contract-id',
    workspaceId: 'workspace-id',
    flowId: 'flow-id',
    userId: 'user-id'
};

export const jwtSecret = 'secret';

export function randomObjectId(): string {
    return randomBytes(16).toString('hex');
}

export function getClient(): Client {
    const client = new Client(baseUri);
    client.sign(jwtPayload, jwtSecret);
    return client;
}

export function getToken(): string {
    return sign(jwtPayload, jwtSecret);
}

export function matchFormData(body: string, name: string, data?: string | Buffer, contentType?: string): boolean {
    // nock returns hex-encoded body for binary responses
    const rawBody = Buffer.from(body, 'hex').toString() || body;
    let search = `Content-Disposition: form-data; name="${name}"\r\n`;
    if (contentType) {
        search += `Content-Type: ${contentType}\r\n`;
    }
    search += '\r\n';
    if (data) {
        search = search + String(data) + '\r\n';
    }
    return rawBody.includes(search);
}
