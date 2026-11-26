import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const keywordMap = await readFile(new URL('../docs/keyword-map.md', import.meta.url), 'utf8');

test('topic clusters assign every workbook-owned target exactly once', () => {
  const ownedTargets = [...keywordMap.matchAll(
    /^\| ([^|]+) \| ([^|]+) \| ([^|]+) \| `([^`]+)` \|$/gm,
  )].map(([, , , , path]) => path);
  const clusterSection = keywordMap
    .split('## Topic clusters and cannibalization boundaries\n')[1]
    ?.split('\n## Ownership rules')[0];
  assert.ok(clusterSection);
  const clusteredTargets = [...clusterSection.matchAll(/`(\/[^`]*)`/g)].map(([, path]) => path);

  assert.equal(ownedTargets.length, 69);
  assert.equal(new Set(ownedTargets).size, ownedTargets.length);
  assert.equal(clusteredTargets.length, ownedTargets.length);
  assert.equal(new Set(clusteredTargets).size, clusteredTargets.length);
  assert.deepEqual([...clusteredTargets].sort(), [...ownedTargets].sort());
  assert.equal(clusteredTargets.filter((path) => path.startsWith('/buy-property/')).length, 58);
  assert.equal(clusteredTargets.filter((path) => path.startsWith('/guides/')).length, 10);
  assert.equal(clusteredTargets.filter((path) => path === '/').length, 1);
});
