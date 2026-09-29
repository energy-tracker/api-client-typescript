import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const temp = await mkdtemp(join(tmpdir(), 'energy-tracker-package-'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
try {
  const [pack] = JSON.parse(
    execFileSync(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', temp], {
      cwd: root,
      encoding: 'utf8',
    }),
  );
  const files = new Set(pack.files.map((entry) => entry.path));
  for (const entry of [
    'dist/cjs/index.js',
    'dist/cjs/index.d.ts',
    'dist/index.mjs',
    'dist/index.d.mts',
    'LICENSE',
    'README.md',
  ])
    assert.ok(files.has(entry), `Missing ${entry}`);
  for (const name of files)
    assert.ok(
      name.startsWith('dist/') || ['LICENSE', 'README.md', 'package.json'].includes(name),
      `Unexpected packed file: ${name}`,
    );
  assert.equal(pack.name, pkg.name);
  assert.equal(pack.version, pkg.version);
  await writeFile(join(temp, 'package.json'), JSON.stringify({ private: true }));
  execFileSync(
    npm,
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      join(temp, pack.filename),
    ],
    { cwd: temp, stdio: 'pipe' },
  );
  const cjs = `const api = require('${pkg.name}'); if (typeof api.EnergyTrackerClient !== 'function') throw Error('Missing client'); if (!(new api.ValidationError('test') instanceof api.EnergyTrackerAPIError)) throw Error('Invalid error hierarchy');`;
  execFileSync(process.execPath, ['-e', cjs], { cwd: temp, stdio: 'inherit' });
  const esm = `import { EnergyTrackerClient, ValidationError } from '${pkg.name}'; import { createRequire } from 'node:module'; const cjs = createRequire(import.meta.url)('${pkg.name}'); if (EnergyTrackerClient !== cjs.EnergyTrackerClient || ValidationError !== cjs.ValidationError) throw Error('Module identity mismatch');`;
  await writeFile(join(temp, 'smoke.mjs'), esm);
  execFileSync(process.execPath, [join(temp, 'smoke.mjs')], { cwd: temp, stdio: 'inherit' });
  const consumer = `import { EnergyTrackerClient, CalculationInterval, type MeterReadingDto } from '${pkg.name}';
const client = new EnergyTrackerClient({accessToken: 'test'});
const result: Promise<MeterReadingDto[]> = client.meterReadings.list('device');
void result;
void client.meterReadings.create('device', {value: '9999999999.999999', timestamp: new Date()});
void client.calculations.extrapolations('device', {interval: CalculationInterval.MONTH});
// @ts-expect-error Meter values must not lose precision through a number.
void client.meterReadings.create('device', {value: 123.45});
// @ts-expect-error Unsupported intervals must be rejected by the type system.
void client.calculations.extrapolations('device', {interval: 'decade'});
`;
  await writeFile(join(temp, 'consumer.mts'), consumer);
  await writeFile(join(temp, 'consumer.cts'), consumer);
  await writeFile(
    join(temp, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022'],
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        types: ['node'],
        typeRoots: [join(root, 'node_modules/@types')],
      },
      files: ['consumer.mts', 'consumer.cts'],
    }),
  );
  for (const name of ['typescript', 'typescript-compat']) {
    const compiler = resolve(
      dirname(require.resolve(`${name}/package.json`)),
      require(`${name}/package.json`).bin.tsc,
    );
    execFileSync(process.execPath, [compiler, '-p', join(temp, 'tsconfig.json')], {
      cwd: temp,
      stdio: 'inherit',
    });
  }
  console.log(
    `Package ${pkg.name}@${pkg.version}: clean contents, CJS/ESM imports and TypeScript consumers verified`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
