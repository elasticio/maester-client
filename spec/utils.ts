import { randomBytes } from 'crypto';

export function randomObjectId(): string {
    return randomBytes(16).toString('hex');
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
