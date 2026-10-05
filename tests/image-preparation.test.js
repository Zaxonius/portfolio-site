import test from 'node:test';
import assert from 'node:assert/strict';
import { compressImage } from '../image-preparation.js';
function environment(width, height, sizes) {
  let closed = false, index = 0;
  const encodings = [];
  const canvas = { getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob(callback, type, quality) { encodings.push({ width: canvas.width, height: canvas.height, type, quality }); callback(new Blob([new Uint8Array(sizes[Math.min(index++, sizes.length - 1)])], { type })); } };
  return { options: { decode: async () => ({ width, height, close() { closed = true; } }), makeCanvas: () => canvas }, encodings, closed: () => closed };
}
test('large originals produce only a small JPEG with preserved aspect ratio', async () => {
  const env = environment(8000, 6000, [150000]);
  const original = { size: 50 * 1024 * 1024 };
  const output = await compressImage(original, env.options);
  assert.notEqual(output, original); assert.equal(output.type, 'image/jpeg'); assert.ok(output.size <= 200 * 1024);
  assert.deepEqual(env.encodings[0], { width: 1000, height: 750, type: 'image/jpeg', quality: .8 }); assert.ok(env.closed());
});
test('portrait photos are limited on the long edge and small photos are not enlarged', async () => {
  for (const [width, height, expected] of [[6000, 9000, [667, 1000]], [300, 200, [300, 200]]]) {
    const env = environment(width, height, [10000]); await compressImage({}, env.options); assert.deepEqual([env.encodings[0].width, env.encodings[0].height], expected);
  }
});
test('complex photos reduce quality then dimensions until the size target is met', async () => {
  const env = environment(8000, 6000, [500000, 400000, 300000, 250000, 150000]);
  const output = await compressImage({}, env.options); assert.ok(output.size <= 200 * 1024); assert.equal(env.encodings[4].width, 800); assert.ok(env.closed());
});
test('compression failure never returns the original and releases image memory', async () => {
  const env = environment(8000, 6000, [300000]); await assert.rejects(compressImage({}, env.options), /Could not compress/); assert.ok(env.closed());
});
