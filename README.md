# Maester Client

The official Elastic.io object-storage client.

## Usage

Note: All the code snippets written in Typescript

### Create client
```
import { ObjectStorageWrapper } from '@elastic.io/maester-client/dist/ObjectStorageWrapper';

const objectStorage = new ObjectStorageWrapper(this);
```

### CRUD operations

### Create object

The method has the following signature:
```
async createObject(data: object, queryHeaders?: Header[], metaHeaders?: Header[], ttl?: number)
```
where
- data - object data to create. *Required*
- queryHeaders - array of objects `{ key: string, value: string }`, current maximum - 5 items. Where `key` - searchable field name (see below in `Get objects by query parameters` section), must be unique for whole array, if specified - `value` must be specified as well; `value` - searchable field value, if specified - `key` must be specified as well. *Optional*
- metaHeaders - array of objects `{ key: string, value: string }`, where `key` - meta field name, must be unique for whole array, if specified - `value` must be specified as well; `value` - meta field value, if specified - `key` must be specified as well. *Optional*
- ttl - configurable object's time to live, seconds. *Optional*

```
const obj = await objectStorage.createObject(data);
const obj = await objectStorage.createObject(data, [], [], 100000);
const obj = await objectStorage.createObject(
  data,
  [{key: 'somequeriablefieldkey', value: 'somequeriablefieldvalue'}],
  [{key: 'somemetakey', value: 'somemetavalue'}],
  60000
);
const obj = await objectStorage.createObject(
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
async lookupObjectById(id: string)
```
where
- id - Maester internal id of the object to update. E.g. '76380cae-aee3-457a-9029-d971f61e3731'. *Required*

```
const obj = await objectStorage.lookupObjectById(id);
```
As Maester is able to store any data type, the method returns **a raw string**.
You may want to parse JSON or do any other data processing according to object's expected data type:
```
const parsedObject = JSON.parse(obj);
```
#### Get objects by query parameters

The method has the following signature:
```
async lookupObjectsByQueryParameters(headers: Header[])
```
where
- headers - array of objects `{ key: string, value: string }`, current maximum - 5 items. Where `key` - searchable field name, must be unique for whole array, if specified - `value` must be specified as well; `value` - searchable field value, if specified - `key` must be specified as well. *Required*

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
const obj = await objectStorage.lookupObjectsByQueryParameters([
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
- queryHeaders - array of objects `{ key: string, value: string }`, current maximum - 5 items. Where `key` - searchable field name (see below in `Get objects by query parameters` section), must be unique for whole array, if specified - `value` must be specified as well; `value` - searchable field value, if specified - `key` must be specified as well. Note: queryHeaders could be added to an existing object and modified as well, but they can not be deleted. *Optional*
- metaHeaders - array of objects `{ key: string, value: string }`, where `key` - meta field name, must be unique for whole array, if specified - `value` must be specified as well; `value` - meta field value, if specified - `key` must be specified as well. Note: metaHeaders could be added to an existing object and modified as well, but they can not be deleted. *Optional*

```
const obj = await objectStorage.updateObject(id, data);
const obj = await objectStorage.updateObject(
  id,
  data,
  [{ key: 'somequeriablefieldkey', value: 'somequeriablefieldvalue' }, { key: 'anotherqueriablefieldkey', value: 'anotherqueriablefieldvalue' }]
);
const obj = await objectStorage.updateObject(
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
- id - Maester internal id of the object to update. E.g. '76380cae-aee3-457a-9029-d971f61e3731'. *Required*

```
const obj = await objectStorage.deleteObjectById(id);
```

#### Delete objects by query parameters
The method has the following signature:
```
async deleteObjectsByQueryParameters(headers: Header[])
```
where
- headers - array of objects `{ key: string, value: string }`, current maximum - 5 items. Where `key` - searchable field name, must be unique for whole array, if specified - `value` must be specified as well; `value` - searchable field value, if specified - `key` must be specified as well. *Required*
```
const obj = await objectStorage.deleteObjectsByQueryParameters([{key: 'somequeriablefieldkey', value: 'somequeriablefieldvalue'}]);
```