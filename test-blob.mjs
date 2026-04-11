import { list, put } from '@vercel/blob';

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
console.log('Token starts with:', blobToken?.slice(0, 20));

console.log('=== Writing a test blob ===');
const result = await put('shares/test-abc123.json', '{"test":true}', { access: 'public', contentType: 'application/json' });
console.log('Put URL:', result.url);

console.log('\n=== Listing blobs ===');
const { blobs } = await list({ prefix: 'shares/', limit: 5 });
console.log('Count:', blobs.length);
blobs.forEach(b => console.log(' -', b.pathname, b.url));
