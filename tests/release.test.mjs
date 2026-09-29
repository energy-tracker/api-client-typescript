import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { releaseInfo } from '../scripts/check-release.mjs';

for (const version of ['1.0.0', '1.2.3', '2.0.0']) {
  test(`stable release ${version}`, () =>
    assert.deepEqual(releaseInfo(`v${version}`, version), {
      prerelease: false,
      distTag: 'latest',
    }));
}
for (const version of ['1.0.0-alpha.1', '1.0.0-beta.2', '1.0.0-rc.1', '2.0.0-dev.1']) {
  test(`prerelease ${version}`, () =>
    assert.deepEqual(releaseInfo(`v${version}`, version), { prerelease: true, distTag: 'next' }));
}
for (const [tag, version] of [
  ['1.0.0', '1.0.0'],
  ['v2.0.0', '1.0.0'],
  ['v01.0.0', '01.0.0'],
  ['v1.0', '1.0'],
  ['v1.0.0+build', '1.0.0+build'],
  ['vnot-a-version', 'not-a-version'],
]) {
  test(`reject release ${tag} / ${version}`, () => assert.throws(() => releaseInfo(tag, version)));
}
test('release CLI validates metadata outside the checkout', () => {
  const script = fileURLToPath(new URL('../scripts/check-release.mjs', import.meta.url));
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(
    execFileSync(process.execPath, [script, `v${version}`], { cwd: tmpdir(), encoding: 'utf8' }),
    /dist_tag=latest/,
  );
  const result = spawnSync(process.execPath, [script, 'v0.0.0'], {
    cwd: tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Release tag must equal/);
});
