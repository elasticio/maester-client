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
async createObject(data: object, queryKey?: string, queryValue?: string, ttl?: number)
```
where
- data - object data to create. *Required*
- queryKey, queryValue - searchable field (see below in `Get objects by query parameter` section). *Optional*, but if queryKey is specified, queryValue must be specified as well. 
- ttl - configurable object's time to live, milliseconds. *Optional*

```
const obj = await objectStorage.createObject(data, somequeriablefieldKey, somequeriablefieldValue, 60000);
```

### Read operations
#### Get object by ID:

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
The following errors can be thrown:
- Object Not Found
- Invalid object id

#### Get objects by query parameter:

The method has the following signature:
```
async lookupObjectByQueryParameter(key: string, value: string)
```
where
- key, value - searchable field. *Required*

If you create an object with a queriable header, internally it looks like this:
```
x-query-somequeriablefieldKey: somequeriablefieldValue
```
where 'x-query-' is a default prefix.

Using Maester REST API you can find this object by:
```
/objects?query[somequeriablefieldkey]=somequeriablefieldValue
```
Using the library:
```
const obj = await objectStorage.lookupObjectByQueryParameter('somequeriablefieldKey', 'somequeriablefieldValue');
```

### Update object

The method has the following signature:
```
async updateObject(id: string, data: object)
```
where
- id - Maester internal id of the object to update. E.g. '76380cae-aee3-457a-9029-d971f61e3731'. *Required*
- data - object to update. *Required*

```
const obj = await objectStorage.updateObject(id, data);
```

### Delete object

The method has the following signature:
```
async deleteObjectById(id: string)
```
where
- id - Maester internal id of the object to update. E.g. '76380cae-aee3-457a-9029-d971f61e3731'. *Required*

```
const obj = await objectStorage.deleteObjectById(id);
```
