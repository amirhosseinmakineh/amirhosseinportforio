import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

// Usage: node scripts/package-runflare.mjs /absolute/published/LicenseServer /absolute/output.zip
const [runtimeArg, outputArg] = process.argv.slice(2);
if (!runtimeArg || !outputArg) throw new Error('Provide the self-contained Linux x64 license runtime and output ZIP paths.');
const runtime = resolve(runtimeArg), output = resolve(outputArg);
if (!existsSync(join(runtime, 'Api')) || !existsSync(join(runtime, 'Api.deps.json'))) throw new Error('Expected a published self-contained LicenseServer/Api runtime.');
const stage = mkdtempSync(join(tmpdir(), 'portfolio-runflare-'));
try {
  const archive = execFileSync('git', ['archive', 'HEAD']);
  execFileSync('tar', ['-x', '-C', stage], { input: archive });
  cpSync(runtime, join(stage, 'runtime/license-server'), { recursive: true });
  // Licensing data, admin/signing keys and Framework source must never enter this archive.
  for (const name of ['signing-key.pem', 'admin-key', 'licenses.db', 'data']) {
    if (existsSync(join(runtime, name))) throw new Error('Runtime directory contains private state.');
  }
  writeFileSync(join(stage, 'runtime/license-server/source-commit.txt'), process.env['LICENSE_FRAMEWORK_COMMIT'] ?? '09997a60b44044e00d749c923df504308c79bb11');
  mkdirSync(resolve(output, '..'), { recursive: true });
  execFileSync('python3', ['-c', 'import os,sys,zipfile; root,out=sys.argv[1:]; z=zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED); [(z.write(os.path.join(p,n),os.path.relpath(os.path.join(p,n),root))) for p,_,names in os.walk(root) for n in names]; z.close()', stage, output]);
  console.log('Runflare bundle assembled from the committed portfolio and private compiled runtime.');
} finally { rmSync(stage, { recursive: true, force: true }); }
