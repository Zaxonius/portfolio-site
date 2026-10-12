import test from 'node:test';
import assert from 'node:assert/strict';
import { publishBatch, applyPhotoChanges, deletePhotos } from '../photo-management.js';

test('batch retries retain uploaded URLs, captions and successful saves', async () => {
  const items = ['one', 'two', 'three'].map(name => ({ file: name, caption: name + ' caption', state: 'queued', url: '' }));
  let compressed = 0, uploaded = 0, fail = true;
  const saves = [];
  const services = {
    compress: async file => { compressed++; return file; },
    upload: async blob => { uploaded++; return 'https://example.test/' + blob; },
    publish: async item => { if (item.file === 'two' && fail) throw new Error('Save failed'); saves.push([item.url, item.caption]); }
  };
  await publishBatch(items, services);
  assert.deepEqual(items.map(item => item.state), ['published', 'failed', 'published']);
  fail = false;
  await publishBatch(items, services);
  assert.equal(compressed, 3); assert.equal(uploaded, 3);
  assert.equal(saves.length, 3);
  assert.ok(saves.some(([url, caption]) => url.endsWith('/two') && caption === 'two caption'));
});

test('batch compression failures do not block later photos, and expired sessions stop the queue', async () => {
  const items = ['bad', 'good', 'expired', 'later'].map(file => ({ file, caption: '', state: 'queued' }));
  let session = true;
  await publishBatch(items, {
    compress: async file => { if(file === 'bad') throw new Error('Invalid image'); return file; },
    upload: async file => file,
    publish: async item => { if(item.file === 'expired') { session = false; throw new Error('Session expired'); } },
    canContinue: () => session
  });
  assert.deepEqual(items.map(item => item.state), ['failed', 'published', 'failed', 'queued']);
});

function galleryApi() {
  const calls = [], store = { a: [{ id:'a1', url:'one', description:'old' }], b: [] };
  const api = async (path, options = {}) => {
    calls.push({ path, ...options });
    const match = path.match(/^\/galleries\/([^/]+)(?:\/photos(?:\/([^/]+))?)?$/);
    if(!options.method) return { photos: structuredClone(store[match[1]]) };
    if(options.method === 'POST') {
      const data = JSON.parse(options.body); const saved = { id: 'copy-' + data.url, ...data }; store[match[1]].push(saved); return saved;
    }
    if(options.method === 'DELETE') { store[match[1]] = store[match[1]].filter(p=>p.id !== match[2]); return {}; }
    return {};
  };
  return { calls, store, api };
}

test('multi-photo settings add missing copies and remove private membership without deleting public photos', async () => {
  const { calls, store, api } = galleryApi();
  const photos = [{id:'p1', url:'one', description:'first'}, {id:'p2', url:'two', description:'second'}];
  const result = await applyPhotoChanges(photos, '', {caption:'Shared caption', memberships:[{slug:'a',action:'remove'}, {slug:'b',action:'add'}]}, api);
  assert.equal(result.completed, 2); assert.equal(result.failed.length, 0);
  assert.equal(store.a.length, 0); assert.equal(store.b.length, 2);
  assert.ok(store.b.every(photo=>photo.description === 'Shared caption'));
  assert.equal(calls.filter(call=>call.method === 'PATCH').length, 2);
  assert.ok(!calls.some(call=>call.method === 'DELETE' && call.path.startsWith('/photos/')));
  const repeated = await applyPhotoChanges(photos, '', { memberships:[{slug:'b',action:'add'}] }, api);
  assert.equal(repeated.completed, 2); assert.equal(store.b.length, 2);
});

test('retry after a partial gallery operation skips captions for an already removed source copy', async () => {
  const { api, store, calls } = galleryApi();
  let fail = true;
  const unreliable = (path, options) => {
    if(path === '/galleries/b/photos' && options?.method === 'POST' && fail) throw new Error('Offline');
    return api(path, options);
  };
  const photos=[{ id:'a1',url:'one',description:'old' }];
  const changes={caption:'New',memberships:[{slug:'a',action:'remove'}, {slug:'b',action:'add'}]};
  const first=await applyPhotoChanges(photos,'a',changes,unreliable);
  assert.equal(first.failed.length,1); assert.equal(store.a.length,0);
  fail=false;
  const second=await applyPhotoChanges(first.failed.map(item=>item.photo),'a',changes,unreliable);
  assert.equal(second.completed,1); assert.equal(store.b.length,1);
  assert.equal(calls.filter(call=>call.method === 'PATCH').length,1);
});


test('bulk deletion only removes selected gallery records and retains failures for retry', async () => {
  const photos = [{id:'first'}, {id:'second'}, {id:'third'}];
  const calls = [], removed = [];
  const api = async (path, options) => {
    calls.push({path, method:options.method});
    if (path.endsWith('/second')) throw new Error('Offline');
    if (path.endsWith('/third')) { const error = new Error('Already deleted'); error.status=404; throw error; }
  };
  const result=await deletePhotos(photos,'wildlife',api,photo=>removed.push(photo.id));
  assert.equal(result.completed,2);
  assert.deepEqual(result.failed.map(item=>item.photo.id),['second']);
  assert.deepEqual(removed,['first','third']);
  assert.ok(calls.every(call=>call.path.startsWith('/galleries/wildlife/photos/') && call.method==='DELETE'));
  const retried=[];
  await deletePhotos(result.failed.map(item=>item.photo),'wildlife',async path=>retried.push(path));
  assert.deepEqual(retried,['/galleries/wildlife/photos/second']);
});

test('bulk deletion stops after session expiry and retains all remaining selections', async () => {
  let calls=0;
  const result=await deletePhotos([{id:'one'},{id:'two'}],'',async()=>{
    calls++; const error=new Error('Sign in again'); error.status=401; throw error;
  });
  assert.equal(calls,1); assert.equal(result.completed,0); assert.equal(result.failed.length,2);
});
