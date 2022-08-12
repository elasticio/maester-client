import { ObjectStorage } from './ObjectStorage';
import { uploadData, TTL_HEADER } from './interfaces';

export const MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS = 5;
const isHeaders = (headers?: Header[]): boolean => headers && headers.length > 0;

export interface Scope {
  logger: object;
}
export interface Header {
  key: string,
  value: string
}
export interface KeyIndexer {
  [key: string]: string
}

export class ObjectStorageWrapper {
  logger: any;

  token: string;

  url: string;

  objectStorage: any;

  constructor(context: Scope, userAgent?: string) {
    this.logger = context.logger;
    if (!process.env.ELASTICIO_OBJECT_STORAGE_TOKEN || !process.env.ELASTICIO_OBJECT_STORAGE_URI) {
      throw new Error('Can not find storage token or storage uri values... Check environment variables');
    }
    this.token = process.env.ELASTICIO_OBJECT_STORAGE_TOKEN;
    this.url = process.env.ELASTICIO_OBJECT_STORAGE_URI;
    this.objectStorage = new ObjectStorage({ uri: this.url, jwtSecret: this.token, userAgent });
  }

  /**
   * @param data any data (except 'undefined')
   */
  async createObject(data: uploadData, queryHeaders?: Header[], metaHeaders?: Header[], ttl?: number) {
    this.logger.debug('Going to create an object...');
    if (isHeaders(queryHeaders)) ObjectStorageWrapper.validateQueryHeaders(queryHeaders);
    if (isHeaders(metaHeaders)) ObjectStorageWrapper.validateMetaHeaders(metaHeaders);
    const resultHeaders = ObjectStorageWrapper.formHeadersToAdd(queryHeaders, metaHeaders);
    if (ttl) resultHeaders[TTL_HEADER] = ttl.toString();
    return this.objectStorage.add(data, { headers: resultHeaders });
  }

  async deleteObjectById(id: string) {
    this.logger.debug(`Going to delete an object with id ${id}...`);
    return this.objectStorage.deleteOne(id);
  }

  async deleteObjectsByQueryParameters(headers: Header[]) {
    this.logger.debug('Going to delete objects by query parameters...');
    ObjectStorageWrapper.validateQueryHeaders(headers);
    const resultParams = ObjectStorageWrapper.getQueryParams(headers);
    return this.objectStorage.deleteAllByParams(resultParams);
  }

  async lookupObjectById(id: string) {
    this.logger.debug(`Going to find an object by id ${id}...`);
    return this.objectStorage.getOne(id);
  }

  async getObjectHeaders(id: string) {
    this.logger.debug(`Going to fetch object headers by id ${id}...`);
    return this.objectStorage.getHeaders(id);
  }

  async lookupObjectsByQueryParameters(headers: Header[]) {
    this.logger.debug('Going to find an object by query parameters');
    ObjectStorageWrapper.validateQueryHeaders(headers);
    const resultParams = ObjectStorageWrapper.getQueryParams(headers);
    return this.objectStorage.getAllByParams(resultParams);
  }

  /**
   * @param data any data (except 'undefined')
   */
  async updateObjectById(id: string, data: uploadData, queryHeaders?: Header[], metaHeaders?: Header[]) {
    this.logger.debug(`Going to update and object with id ${id}...`);
    if (isHeaders(queryHeaders)) ObjectStorageWrapper.validateQueryHeaders(queryHeaders);
    if (isHeaders(metaHeaders)) ObjectStorageWrapper.validateMetaHeaders(metaHeaders);
    const resultHeaders = ObjectStorageWrapper.formHeadersToAdd(queryHeaders, metaHeaders);
    return this.objectStorage.update(id, data, { headers: resultHeaders });
  }

  private static validateQueryHeaders(headers: Header[]) {
    if (headers.length === 0) {
      throw new Error('At least one query header must be present');
    }
    if (headers.length > MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS) {
      throw new Error(`maximum available amount of headers is ${MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS}`);
    }
    ObjectStorageWrapper.validateHeadersFormat(headers);
  }

  private static validateMetaHeaders(headers: Header[]) {
    ObjectStorageWrapper.validateHeadersFormat(headers);
  }

  private static validateHeadersFormat(headers: Header[]) {
    if (!headers) return;
    // eslint-disable-next-line no-restricted-syntax
    for (const { key, value } of headers) {
      if (key && !value) throw new Error('header "value" is mandatory if header "key" passed');
      if (value && !key) throw new Error('header "key" is mandatory if header "value" passed');
    }
  }

  private static formHeadersToAdd(queryHeaders: Header[], metaHeaders: Header[]): KeyIndexer {
    return {
      ...ObjectStorageWrapper.formHeadersToAddByType(queryHeaders, 'query'),
      ...ObjectStorageWrapper.formHeadersToAddByType(metaHeaders, 'meta'),
    };
  }

  private static formHeadersToAddByType(headers: Header[], headerName: string): any {
    const resultHeaders: KeyIndexer = {};
    if (!headers) return;
    // eslint-disable-next-line no-restricted-syntax
    for (const { key, value } of headers) {
      const header = `x-${headerName}-${key}`;
      // eslint-disable-next-line no-prototype-builtins
      if (resultHeaders.hasOwnProperty(header)) throw new Error(`header key "${key}" was already added`);
      resultHeaders[header] = value;
    }
    // eslint-disable-next-line consistent-return
    return resultHeaders;
  }

  private static getQueryParams(headers: Header[]) {
    if (!headers) return {};
    const resultParams: KeyIndexer = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const { key, value } of headers) {
      const queryKey: string = `query[${key}]`;
      // eslint-disable-next-line no-prototype-builtins
      if (resultParams.hasOwnProperty(queryKey)) throw new Error(`header key "${key}" was already added`);
      resultParams[queryKey] = value;
    }
    return resultParams;
  }
}
