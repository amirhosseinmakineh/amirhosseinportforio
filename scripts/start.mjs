import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, chmodSync, realpathSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, NODE_ENV: process.env['NODE_ENV'] ?? 'production' };
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => { for (const child of children) child.kill('SIGKILL'); process.exit(code); }, 5000).unref();
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stop());

if (env['LICENSE_EMBEDDED'] === 'true') {
  // The optional private runtime is assembled outside the public source repository.
  const binary = join(root, 'runtime/license-server/Api');
  const data = resolve(env['LICENSE_DATA_PATH'] ?? '/data/licensing');
  try {
    if (!existsSync(binary) || !existsSync(data)) throw new Error('runtime or persistent disk missing');
    const real = realpathSync(data);
    const mounted = readFileSync('/proc/self/mountinfo', 'utf8').split('\n').some(line => {
      const mount = line.split(' ')[4]?.replaceAll('\\040', ' ');
      return mount && mount !== '/' && (real === mount || real.startsWith(mount + '/'));
    });
    if (!mounted) {
      throw new Error('a persistent data mount is required');
    }
    const keyPath = join(data, 'signing-key.pem');
    const adminPath = join(data, 'admin-key');
    const initialized = join(data, 'initialized');
    if (existsSync(initialized) && (!existsSync(keyPath) || !existsSync(adminPath))) {
      throw new Error('existing licensing keys are missing; restore the disk backup');
    }
    if (!existsSync(keyPath)) {
      const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
      writeFileSync(keyPath, privateKey, { mode: 0o600, flag: 'wx' });
    }
    if (!existsSync(adminPath)) writeFileSync(adminPath, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
    chmodSync(keyPath, 0o600); chmodSync(adminPath, 0o600);
    const adminKey = readFileSync(adminPath, 'utf8').trim();
    if (adminKey.length < 32) throw new Error('invalid administrator key');
    chmodSync(binary, 0o700);
    const service = spawn(binary, [], { cwd: dirname(binary), stdio: 'inherit', env: {
      ...env, ASPNETCORE_ENVIRONMENT: 'Production', ASPNETCORE_URLS: 'http://127.0.0.1:5105',
      DOTNET_PROCESSOR_COUNT: '2', Server__DataPath: join(data, 'records'), Server__PrivateKeyPath: keyPath,
      Server__AdminKey: adminKey, Server__KeyId: 'portfolio-license-1', Server__TrustedProxies__0: '127.0.0.1',
      Logging__LogLevel__Default: 'Warning',
    } });
    children.push(service);
    await new Promise((ready, reject) => { service.once('spawn', ready); service.once('error', reject); });
    let healthy = false;
    for (let i = 0; i < 50 && service.exitCode === null; i++) {
      try { healthy = (await fetch('http://127.0.0.1:5105/healthz', { signal: AbortSignal.timeout(1000) })).ok; } catch {}
      if (healthy) break;
      await new Promise(done => setTimeout(done, 200));
    }
    if (!healthy) { service.kill(); throw new Error('licensing runtime did not become healthy'); }
    if (!existsSync(initialized)) writeFileSync(initialized, 'portfolio-license-1\n', { mode: 0o600 });
    env['LICENSE_SERVER_URL'] = 'http://127.0.0.1:5105';
    env['LICENSE_EMBEDDED_ACTIVE'] = 'true';
    // The private process is reachable only on loopback. HTTPS ends at the portfolio's ingress.
    console.log('Embedded licensing is ready; credentials remain on the persistent disk.');
    service.once('exit', code => { if (!stopping) console.error(`Licensing process stopped (${code}); management will be unavailable.`); });
  } catch (error) {
    delete env['LICENSE_SERVER_URL']; delete env['LICENSE_EMBEDDED_ACTIVE'];
    console.error('Embedded licensing unavailable:', error.message);
  }
}
const web = spawn(process.execPath, [join(root, 'dist/amirhosseinportforio/server/server.mjs')], { cwd: root, env, stdio: 'inherit' });
children.push(web);
web.once('error', () => stop(1));
web.once('exit', code => { if (!stopping) { stop(code ?? 1); process.exitCode = code ?? 1; } });
