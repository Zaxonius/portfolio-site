import test from 'node:test';
import assert from 'node:assert/strict';
import { photoRows } from '../photo-layout.js';

test('horizontal rows fill the available width without changing photo proportions', () => {
  const ratios = [1.5, 2 / 3, 1.8, 1.4, 1, 1.6, 1.5];
  const rows = photoRows(ratios, 1000);
  assert.deepEqual(rows.flatMap(row => row.ratios), ratios);
  for (const row of rows.slice(0, -1)) {
    assert.ok(Math.abs(row.ratios.reduce((sum, ratio) => sum + ratio * row.height, 0) + 18 * (row.ratios.length - 1) - 1000) < .001);
  }
  assert.ok(rows.at(-1).height <= 210);
});

test('mobile rows and a single final photo stay inside the viewport', () => {
  for (const ratios of [[1.5], [2 / 3, 1.5, 2, 1, 1.5]]) {
    for (const row of photoRows(ratios, 320, 145)) {
      assert.ok(row.height > 0);
      assert.ok(row.ratios.reduce((sum, ratio) => sum + ratio * row.height, 0) + 18 * (row.ratios.length - 1) <= 320.001);
    }
  }
});
