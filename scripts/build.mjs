import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });
const compiler = resolve(
  dirname(require.resolve('typescript/package.json')),
  require('typescript/package.json').bin.tsc,
);
execFileSync(process.execPath, [compiler], { cwd: root, stdio: 'inherit' });
await mkdir(new URL('../dist', import.meta.url), { recursive: true });
// Both module systems share one implementation and the same error-class identities.
const exports = Object.keys(require('../dist/cjs/index.js'));
await writeFile(
  new URL('../dist/index.mjs', import.meta.url),
  `import api from './cjs/index.js';\n${exports.map((name) => `export const ${name} = api.${name};`).join('\n')}\n`,
);
await writeFile(
  new URL('../dist/index.d.mts', import.meta.url),
  "export * from './cjs/index.js';\n",
);
