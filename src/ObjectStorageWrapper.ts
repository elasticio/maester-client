import ObjectStorage from './ObjectStorage';

export const MAESTER_MAX_SUPPORTED_COUNT_OF_QUERY_HEADERS = 5;
export const TTL_HEADER = 'x-eio-ttl';

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

  constructor(context: Scope) {
    this.logger = context.logger;
    if (!process.env.ELASTICIO_OBJECT_STORAGE_TOKEN || !process.env.ELASTICIO_OBJECT_STORAGE_URI) {
      throw new Error('Can not find storage token or storage uri values... Check environment variables');
    }
    this.token = process.env.ELASTICIO_OBJECT_STORAGE_TOKEN;
    this.url = process.env.ELASTICIO_OBJECT_STORAGE_URI;
    this.objectStorage = new ObjectStorage({ uri: this.url, jwtSecret: this.token });
  }

  async createObject(data: object, queryHeaders?: Header[], metaHeaders?: Header[], ttl?: number) {
    this.logger.debug('Going to create an object...');
    ObjectStorageWrapper.validateQueryHeaders(queryHeaders);
    ObjectStorageWrapper.validateMetaHeaders(metaHeaders);

    const resultHeaders: KeyIndexer = {
      ...ObjectStorageWrapper.getPostHeaders(queryHeaders, 'query'),
      ...ObjectStorageWrapper.getPostHeaders(metaHeaders, 'meta'),
    };
    if (ttl) resultHeaders[TTL_HEADER] = ttl.toString();
    return this.objectStorage.postObject(data, resultHeaders);
  }

  async deleteObjectById(id: string) {
    this.logger.debug(`Going to delete an object with id ${id}...`);
    return this.objectStorage.deleteOne(id);
  }

  async deleteObjectsByQueryParameters(headers: Header[]) {
    this.logger.debug('Going to delete objects by query parameters...');
    ObjectStorageWrapper.validateQueryHeaders(headers);
    const resultParams = ObjectStorageWrapper.getQueryParams(headers);
    return this.objectStorage.deleteMany(resultParams);
  }

  async lookupObjectById(id: string) {
    this.logger.debug(`Going to find an object by id ${id}...`);
    return this.objectStorage.getById(id);
  }

  async lookupObjectsByQueryParameters(headers: Header[]) {
    this.logger.debug('Going to find an object by query parameters');
    ObjectStorageWrapper.validateQueryHeaders(headers);
    const resultParams = ObjectStorageWrapper.getQueryParams(headers);
    const result = await this.objectStorage.getAllByParams(resultParams);
    this.logger.debug(`Trying to parse the response to JSON: ${JSON.stringify(result)}`);
    return ObjectStorageWrapper.parseJson(result);
  }

  async updateObject(id: string, data: object) {
    this.logger.debug(`Going to update and object with id ${id}...`);
    return this.objectStorage.updateOne(id, data);
  }

  private static validateQueryHeaders(headers: Header[]) {
    if (!headers) return;

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

  private static getPostHeaders(headers: Header[], headerName: string): any {
    const resultHeaders: KeyIndexer = {};
    if (!headers) return;

    // eslint-disable-next-line no-restricted-syntax
    for (const { key, value } of headers) {
      const header = `x-${headerName}-${key}`;
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
      if (resultParams.hasOwnProperty(queryKey)) throw new Error(`header key "${key}" was already added`);
      resultParams[queryKey] = value;
    }

    return resultParams;
  }

  private static parseJson(source: string) {
    let parsedJson;
    try {
      parsedJson = JSON.parse(source);
    } catch (parseError) {
      throw new Error('Could not parse Maester object as it is not a JSON object');
    }
    return parsedJson;
  }
}
