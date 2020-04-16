# Maester Client

The official object-storage client for elasticio-sailor-nodejs.

## Usage

### Create client
```
const Client = require('@elasticio/maester-client');

const jwtPayload = {
    tenantId: 'tenant-id',
    contractId: 'contract-id',
    workspaceId: 'workspace-id',
    flowId: 'flow-id',
    userId: 'user-id'
};

const jwtSecret = 'my-super-secret';

const client = new Client('http://maester.local:3002');
client.sign(jwtPayload, jwtSecret);
```

### Buckets API

Get bucket:

```
const bucket = await client.buckets.get(id);
```

List buckets:

```
const buckets = await client.buckets.list({
    page: {
        number: 1,
        size: 25
    }
});
```

List buckets by external ID:

```
const buckets = await client.buckets.list({
    externalId: 'my-external-id'
});
```

Create bucket:

```
const bucket = await client.buckets.create({
    objects: ['object-1', 'object-2', ..., 'object-N'],
    extrenalId: 'my-external-id
});
```

Update bucket:

```
const bucket = await client.buckets.update(id, {
    closed: true
});
```

Delete bucket:

```
await client.buckets.delete(id);
```

### Objects API

Get object:

```
const object = await client.objects.get(id);
console.log(object.data);
```

Get object as stream:

```
const object = await client.objects.get(id, 'stream');
object.data.pipe(...)
```

Create object:

```
const response = await client.objects.create(data);
```

where `data` can be `string`, `Buffer`, `FormData` or `Stream`

Create object with metadata:

```
const response = await client.objects.create(data, {
    metadata: {
        key: 'value'
    }
});
```

Create object and add it to a bucket:

```
const response = await client.objects.create(data, {
    bucket: 'bucket-id'
});
```

Create object and override content type:

```
const response = await client.objects.create(data, {
    contentType: 'text/plain'
});
```

Create multiple objects at once:

```
const FormData = require('form-data');

const data = new FormData();
data.append('data', 'hello world', { contentType: 'text/plain' });
data.append('data', JSON.stringify(json), { contentType: 'application/json' });
data.append('data', fs.createReadStream('/foo/bar.jpg'))
data.append('data', Buffer.allocUnsafe(1024));

const response = await client.objects.create(data, {
    bucket: 'bucket-id',
    metadata: {
        description: 'my stuff'
    }
});
```

Delete object:

```
await client.objects.delete(id);
```
