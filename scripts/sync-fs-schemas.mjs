#!/usr/bin/env node
// Maintainer-only: the package is restricted, so this needs an npm token with access to
// @postman (or a tarball someone with access ran `npm pack` on).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FS_PACKAGE, FS_SOURCE_FILES, fsSchemas } from './fs-schemas.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  if (argv.length !== 1) {
    console.error('Usage: sync-fs-schemas <npm-spec | path.tgz>');
    process.exit(1);
  }
  const input = argv[0];
  if (!fs.existsSync(input)) {
    return input;
  }
  if (fs.statSync(input).isDirectory()) {
    console.error('Refusing directory: pack a published version; a local v3-sdk build can differ from the release');
    process.exit(1);
  }
  return path.resolve(input);
}

function packAndExtract(input, tmp) {
  const packResult = JSON.parse(
    execFileSync('npm', ['pack', input, '--json', '--ignore-scripts', '--pack-destination', tmp], { cwd: tmp, encoding: 'utf8' }),
  )[0];
  if (packResult.name !== FS_PACKAGE.name) {
    throw new Error(`Expected ${FS_PACKAGE.name}, got ${packResult.name}`);
  }
  const tarball = path.join(tmp, packResult.filename);
  execFileSync('tar', ['-xzf', tarball], { cwd: tmp });
  const packageDir = path.join(tmp, 'package');
  return {
    provenance: { name: packResult.name, version: packResult.version, integrity: packResult.integrity },
    packageDir,
  };
}

function main() {
  const input = parseArgs(process.argv.slice(2));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-schemas-'));

  try {
    const { provenance, packageDir } = packAndExtract(input, tmp);
    const read = (file) => JSON.parse(fs.readFileSync(path.join(packageDir, file), 'utf8'));

    fsSchemas(read);

    const dest = path.join(ROOT, FS_PACKAGE.dir);
    const staging = dest + '.tmp';

    fs.rmSync(staging, { recursive: true, force: true });
    fs.mkdirSync(staging, { recursive: true });

    for (const file of FS_SOURCE_FILES) {
      const src = path.join(packageDir, file);
      const out = path.join(staging, file);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.copyFileSync(src, out);
    }

    fs.writeFileSync(
      path.join(staging, 'provenance.json'),
      JSON.stringify(provenance, null, 2) + '\n',
    );

    fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(staging, dest);

    console.log(
      `Vendored ${provenance.name}@${provenance.version} (${provenance.integrity}) into ${FS_PACKAGE.dir}: ${FS_SOURCE_FILES.length} files`,
    );
    console.log('Next: pnpm test, then commit vendor/');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
