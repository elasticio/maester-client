# Maester Client

The official Elastic.io object-storage client.

## Usage

This library propose you two clients: `ObjectStorage` & `ObjectStorageWrapper`. 
Use `ObjectStorageWrapper` to operate with data like `string`, `number`, `object`, `array`
Use `ObjectStorage` to operate attachments (also could be used for same purpose as `ObjectStorageWrapper`)

Note: All the code snippets written in Typescript

### Create client
```
import { ObjectStorage, ObjectStorageWrapper } from '@elastic.io/maester-client';

const objectStorageWrapper = new ObjectStorageWrapper(this);
const objectStorage = new ObjectStorage(creds);
```

## ObjectStorageWrapper CRUD operations

### Create object

The method has the following signature:
```
async createObject(data: object, queryHeaders?: Header[], metaHeaders?: Header[], ttl?: number)
```
where
- data - any data to create. *Required*
- queryHeaders - array of objects `{ key: string, value: string }`, current maximum - 5 items. Where `key` (must be lowercase) - searchable field name (see below in `Get objects by query parameters` section), must be unique for whole array, if specified - `value` must be specified as well; `value` - searchable field value, if specified - `key` must be specified as well. *Optional*
- metaHeaders - array of objects `{ key: string, value: string }`, where `key` (must be lowercase) - meta field name, must be unique for whole array, if specified - `value` must be specified as well; `value` - meta field value, if specified - `key` must be specified as well. *Optional*
- ttl - configurable object's time to live, seconds. *Optional*

```
const obj = await objectStorageWrapper.createObject(data);
const obj = await objectStorageWrapper.createObject(data, [], [], 100000);
const obj = await objectStorageWrapper.createObject(
  data,
  [{key: 'somequeriablefieldkey', value: 'somequeriablefieldvalue'}],
  [{key: 'somemetakey', value: 'somemetavalue'}],
  60000
);
const obj = await objectStorageWrapper.createObject(
  data,
  [{key: 'anotherqueriablefieldkey', value: 'anotherqueriablefieldvalue'}, {key: 'anotherqueriablefieldkey2', value: 'anotherqueriablefieldvalue2'}],
  [{key: 'somemetakey', value: 'somemetavalue'}],
  60000
);
```

### Read operations

#### Get object by ID

The method has the following signature:
```
async lookupObjectById(id: string, responseType: ResponseType)
```
where
- id - Maester internal id of the object to lookup. E.g. '76380cae-aee3-457a-9029-d971f61e3731'. *Required*
- responseType - One of response-types [`json`, `stream`, `arraybuffer`]. Data will be returned in an appropriate format. Defaults to `json`. *Optional*

```
const obj = await objectStorageWrapper.lookupObjectById(id);
const obj = await objectStorageWrapper.lookupObjectById(id, 'stream');
```
By default method returns **a raw string**, you may want to parse JSON or do any other data processing according to object's expected data type:
```
const parsedObject = JSON.parse(obj);
```

#### Get objects by query parameters

The method has the following signature:
```
async lookupObjectsByQueryParameters(headers: Header[])
```
where
- headers - array of objects `{ key: string, value: string }`, current maximum - 5 items. Where `key` (must be lowercase) - searchable field name, must be unique for whole array, if specified - `value` must be specified as well; `value` - searchable field value, if specified - `key` must be specified as well. *Required*

If you create an object with a queriable headers, internally it looks like this:
```
x-query-somequeriablefieldkey: somequeriablefieldvalue
x-query-anotherqueriablefieldkey: anotherqueriablefieldvalue
```
where 'x-query-' is a default prefix.

Using Maester REST API you can find this object by:
```
/objects?query[somequeriablefieldkey]=somequeriablefieldvalue&query[anotherqueriablefieldkey]=anotherqueriablefieldvalue
```
Using the library:
```
const obj = await objectStorageWrapper.lookupObjectsByQueryParameters([
  { key: 'somequeriablefieldkey', value: 'somequeriablefieldvalue' },
  { key: 'anotherqueriablefieldkey', value: 'anotherqueriablefieldvalue' }
]);
```
The method returns an array of items. It either is empty in case no objects found or contains objects

### Update object

The method has the following signature:
```
async updateObject(id: string, data: object, queryHeaders?: Header[], metaHeaders?: Header[])
```
where
- id - Maester internal id of the object to update. E.g. '76380cae-aee3-457a-9029-d971f61e3731'. *Required*
- data - object to update. *Required*
- queryHeaders - array of objects `{ key: string, value: string }`, current maximum - 5 items. Where `key` (must be lowercase) - searchable field name (see below in `Get objects by query parameters` section), must be unique for whole array, if specified - `value` must be specified as well; `value` - searchable field value, if specified - `key` must be specified as well. Note: queryHeaders could be added to an existing object and modified as well, but they can not be deleted. *Optional*
- metaHeaders - array of objects `{ key: string, value: string }`, where `key` (must be lowercase) - meta field name, must be unique for whole array, if specified - `value` must be specified as well; `value` - meta field value, if specified - `key` must be specified as well. Note: metaHeaders could be added to an existing object and modified as well, but they can not be deleted. *Optional*

```
const obj = await objectStorageWrapper.updateObject(id, data);
const obj = await objectStorageWrapper.updateObject(
  id,
  data,
  [{ key: 'somequeriablefieldkey', value: 'somequeriablefieldvalue' }, { key: 'anotherqueriablefieldkey', value: 'anotherqueriablefieldvalue' }]
);
const obj = await objectStorageWrapper.updateObject(
  id,
  data,
  [{key: 'anotherqueriablefieldkey', value: 'anotherqueriablefieldvalue'}, {key: 'anotherqueriablefieldkey2', value: 'anotherqueriablefieldvalue2'}],
  [{key: 'somemetakey', value: 'somemetavalue'}]
);
```


### Delete operations

#### Delete object by ID

The method has the following signature:
```
async deleteObjectById(id: string)
```
where
- id - Maester internal id of the object to delete. E.g. '76380cae-aee3-457a-9029-d971f61e3731'. *Required*

```
const obj = await objectStorageWrapper.deleteObjectById(id);
```

#### Delete objects by query parameters
The method has the following signature:
```
async deleteObjectsByQueryParameters(headers: Header[])
```
where
- headers - array of objects `{ key: string, value: string }`, current maximum - 5 items. Where `key` (must be lowercase) - searchable field name, must be unique for whole array, if specified - `value` must be specified as well; `value` - searchable field value, if specified - `key` must be specified as well. *Required*
```
const obj = await objectStorageWrapper.deleteObjectsByQueryParameters([{key: 'somequeriablefieldkey', value: 'somequeriablefieldvalue'}]);
```

## ObjectStorage CRUD operations

### Create Object

The method has the following signature:
```
async add(dataOrFunc: uploadData | (() => Promise<Readable>), reqWithBodyOptions?: ReqWithBodyOptions)
```
where
- dataOrFunc - async function returning stream OR any data (except 'undefined').
- [reqWithBodyOptions](/src/interfaces.ts#L27).

```
const obj = await objectStorage.add(data, { override: {'x-query-somequeriablefieldkey': 'somequeriablefieldvalue'} });
const getAttachAsStream = async () => (await axios.get('https://img.jpg', { responseType: 'stream' })).data;
const obj = await objectStorage.add(getAttachAsStream, { retryOptions: { retriesCount: 5, retryDelay: 10000, requestTimeout: 60000 } });
);
```

### Read operations

#### Get object by ID

The method has the following signature:
```
async getOne(objectId: string, reqOptions: ReqOptions = {})
```
where
- id - Maester internal id of the object to lookup. E.g. '76380cae-aee3-457a-9029-d971f61e3731'.
- [reqOptions](/src/interfaces.ts#L22).

```
const obj = await objectStorage.getOne(id);
const obj = await objectStorage.getOne(id, { responseTYpe: 'stream'});
```
By default method returns **a raw string**, you may want to parse JSON or do any other data processing according to object's expected data type:
```
const parsedObject = JSON.parse(obj);
```

#### Get objects by query parameters

The method has the following signature:
```
async getAllByParams(params: object, reqOptions: ReqOptions = {})
```
where
- params - object of query params, current maximum - 5 items. 
- [reqOptions](/src/interfaces.ts#L22).


Examples:
```
const obj = await objectStorage.getAllByParams({ 'query[field]': 'value' });
```
The method returns an array of items. It either is empty in case no objects found or contains objects

### Update Object

The method has the following signature:
```
async update(objectId: string, dataOrFunc: uploadData | (() => Promise<Readable>), reqWithBodyOptions?: ReqWithBodyOptions)
```
where
- objectId - id of the object to update.
- dataOrFunc - async function returning stream OR any data (except 'undefined').
- [reqWithBodyOptions](/src/interfaces.ts#L27)

```
const obj = await objectStorage.update(data, { override: {'x-query-somequeriablefieldkey': 'somequeriablefieldvalue'} });
const getAttachAsStream = async () => (await axios.get('https://img.jpg', { responseType: 'stream' })).data;
const obj = await objectStorage.update(getAttachAsStream);
);
```

### Delete operations

#### Delete object by ID

The method has the following signature:
```
async deleteOne(objectId: string, reqOptions: ReqOptions = {})
```
where
- id - Maester internal id of the object to delete. E.g. '76380cae-aee3-457a-9029-d971f61e3731'.
- [reqOptions](/src/interfaces.ts#L22).

```
const obj = await objectStorage.deleteOne(id);
const obj = await objectStorage.deleteOne(id, { retryOptions: { retriesCount: 5, retryDelay: 10000, requestTimeout: 60000 } });
```

#### Delete objects by query parameters
The method has the following signature:
```
async deleteAllByParams(params: object, reqOptions: ReqOptions = {})
```
where
- params - object of query params, current maximum - 5 items. 
- [reqOptions](/src/interfaces.ts#L22).
```
const obj = await objectStorage.deleteAllByParams({ 'query[field]': 'value' });
```

### Additional methods

#### Use method
The method has the following signature:
```
async use(forward: TransformMiddleware, reverse: TransformMiddleware)
```
where
- forward - transform middleware to use with `Create` and `Update` object operations (`add`, `update` methods).
- reverse - transform middleware to use with `Get` object operations (`getOne`, `getAllByParams` methods).

#### getHeaders method
The method has the following signature:
```
async getHeaders(objectId: string, reqOptions: ReqOptions = {})
```
where
- forward - transform middleware to use with `Create` and `Update` object operations (`add`, `update` methods).
- reverse - transform middleware to use with `Get` object operations (`getOne`, `getAllByParams` methods).

## Limitations

1. Both `ObjectStorage` and `ObjectStorageWrapper` could'n process `undefined` as values for upsert value. Also value `undefined` in array will be converted to `null`, e.g
`[1, 'str', undefined, null, { d: 2 }]` will be saved as `[1, 'str', null, null, { d: 2 }]`