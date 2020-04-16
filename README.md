# Maester Client

The official object-storage client for elasticio-sailor-nodejs.

## Usage

### Create client
```
const Client = require('@elasticio/maester-client');

const client = new Client('http://maester.local:3002', 'my-token');
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

Object's property `data` has value of type `string`, `object`, `Buffer` or `Stream`. 

Get object as JSON:

```
const object = await client.objects.getJSON(id);
console.log(object.data);
```

Get object as buffer:

```
const object = await client.objects.getBuffer(id);
console.log(object.data.toString())
```

Get object as stream:

```
const object = await client.objects.getStream(id);
object.data.pipe(...)
```

Create read stream example:

```
client.objects.createReadStream(id).pipe(fs.createWriteStream('/foo/bar.jpg'));
```

Create object:

```
const response = await client.objects.create(data);
```

Where `data` can be `string`, `Buffer`, `Stream` or array of these values.

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

Create object and override its content type:

```
const response = await client.objects.create({ 
    data: 'hello world',
    contentType: 'text/plain'
});
```

Create multiple objects at once:

```
const data = [
    {
        data: 'hello world'
    },
    {
        data: JSON.stringify(json), 
        contentType: 'application/json'
    },
    data: fs.createReadStream('/foo/bar.jpg'),
    Buffer.allocUnsafe(1024)
];

const response = await client.objects.create(data, {
    bucket: 'bucket-id',
    metadata: {
        description: 'my stuff'
    }
});
```

Writable stream example:

```
fs.createReadStream('/foo/bar.jpg').pipe(client.objects.createWriteStream());
```

Delete object:

```
await client.objects.delete(id);
```
