import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

export function releaseInfo(tag, version) {
  if (semver.valid(version) !== version || semver.parse(version).build.length) {
    throw new Error('Package version must be canonical SemVer without build metadata');
  }
  if (tag !== `v${version}`) throw new Error(`Release tag must equal v${version}`);
  const prerelease = semver.prerelease(version) !== null;
  return { prerelease, distTag: prerelease ? 'next' : 'latest' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
    if (lock.version !== pkg.version || lock.packages[''].version !== pkg.version) {
      throw new Error('package-lock.json version differs from package.json');
    }
    const result = releaseInfo(process.argv[2] ?? process.env.GITHUB_REF_NAME, pkg.version);
    console.log(`prerelease=${result.prerelease}\ndist_tag=${result.distTag}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
