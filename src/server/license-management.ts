import { randomBytes } from 'node:crypto';
import express, { Request, Response } from 'express';

type Session = { cookies: Map<string, string>; csrf: string; expires: number };
type Options = { serverUrl?: string; origin?: string; production?: boolean; embedded?: boolean };
const cookieName = 'portfolio_license_admin';
const lifetime = 60 * 60 * 1000;

class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/** Same-origin admin gateway. Upstream cookies and CSRF tokens stay on the server. */
export function licenseManagementRouter(options: Options = {}) {
  const router = express.Router();
  const production = options.production ?? !['development', 'test'].includes(process.env['NODE_ENV'] ?? '');
  const embedded = options.embedded ?? process.env['LICENSE_EMBEDDED_ACTIVE'] === 'true';
  let serverUrl: string | undefined;
  let allowedOrigin: string | undefined;
  try {
    const url = new URL(options.serverUrl ?? process.env['LICENSE_SERVER_URL'] ?? '');
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback && (!production || embedded))) ||
        url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    serverUrl = url.origin;
    const origin = options.origin ?? process.env['LICENSE_MANAGER_ORIGIN'];
    if (origin) {
      const parsed = new URL(origin);
      if ((production && parsed.protocol !== 'https:') || !['http:', 'https:'].includes(parsed.protocol) ||
          parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error();
      allowedOrigin = parsed.origin;
    } else if (production) {
      serverUrl = undefined;
    }
  } catch { serverUrl = undefined; }

  const sessions = new Map<string, Session>();
  const attempts = new Map<string, { count: number; until: number }>();
  function prune() {
    const now = Date.now();
    for (const [id, value] of sessions) if (value.expires <= now) sessions.delete(id);
    for (const [id, value] of attempts) if (value.until <= now) attempts.delete(id);
  }
  function sessionId(req: Request): string {
    return req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1) ?? '';
  }
  function clearSession(req: Request, res: Response) {
    sessions.delete(sessionId(req));
    res.clearCookie(cookieName, { path: '/api/license-management', httpOnly: true, sameSite: 'strict', secure: production });
  }
  function authorized(req: Request, res: Response): Session {
    const session = sessions.get(sessionId(req));
    if (!session || session.expires <= Date.now()) {
      clearSession(req, res);
      throw new ApiError(401, 'برای مدیریت لایسنس‌ها وارد شوید.');
    }
    return session;
  }
  async function upstream(session: Session, path: string, method = 'GET', body?: unknown): Promise<any> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (embedded) headers['X-Forwarded-Proto'] = 'https';
    if (session.cookies.size) headers['Cookie'] = [...session.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-TOKEN'] = session.csrf;
    }
    const response = await fetch(`${serverUrl}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0];
      const index = pair.indexOf('=');
      if (index > 0) session.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    if (response.status === 204) return undefined;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: typeof data.error === 'string' ? data.error : 'اطلاعات واردشده صحیح نیست.',
        401: 'کلید مدیریت صحیح نیست یا زمان ورود به پایان رسیده است.',
        404: 'لایسنس پیدا نشد؛ فهرست را تازه‌سازی کنید.',
        409: 'اطلاعات این لایسنس تغییر کرده است؛ فهرست را تازه‌سازی کنید.',
        429: 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.',
      };
      throw new ApiError(messages[response.status] ? response.status : 502,
        messages[response.status] ?? 'سرویس لایسنس در دسترس نیست.');
    }
    return data;
  }
  async function refreshCsrf(session: Session) {
    const response = await upstream(session, '/admin/csrf');
    if (typeof response.token !== 'string' || !response.token) throw new Error('Missing upstream CSRF');
    session.csrf = response.token;
  }

  router.use((req, res, next) => {
    prune();
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' });
    res.vary('Cookie');
    if (!['GET', 'POST', 'PUT'].includes(req.method)) return res.sendStatus(405);
    if (req.method !== 'GET') {
      const expectedOrigin = allowedOrigin ?? `${req.protocol}://${req.get('host')}`;
      if (req.get('Origin') !== expectedOrigin || req.get('X-License-Management') !== '1') {
        return res.status(403).json({ error: 'درخواست مدیریت معتبر نیست؛ صفحه را دوباره باز کنید.' });
      }
    }
    return next();
  });
  router.use(express.json({ limit: '16kb', type: 'application/json' }));
  router.get('/session', (req, res) => {
    const active = sessions.has(sessionId(req));
    res.json({ configured: Boolean(serverUrl), authenticated: active, ...(active ? { serverUrl: embedded ? allowedOrigin : serverUrl } : {}) });
  });
  router.use((_req, _res, next) => {
    if (!serverUrl) throw new ApiError(503, 'اتصال به سرویس لایسنس هنوز تنظیم نشده است.');
    next();
  });
  router.post('/login', async (req, res) => {
    const ip = req.ip ?? 'unknown';
    const attempt = attempts.get(ip) ?? { count: 0, until: Date.now() + 15 * 60 * 1000 };
    if (attempt.count >= 5 || (!attempts.has(ip) && attempts.size >= 1000)) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((attempt.until - Date.now()) / 1000))));
      throw new ApiError(429, 'تلاش‌های ورود زیاد است؛ چند دقیقه بعد دوباره امتحان کنید.');
    }
    attempt.count++; attempts.set(ip, attempt);
    if (typeof req.body?.key !== 'string' || req.body.key.length < 32 || req.body.key.length > 4096) {
      throw new ApiError(400, 'کلید مدیریت معتبر را وارد کنید.');
    }
    if (sessions.size >= 1000) throw new ApiError(503, 'ورود موقتاً در دسترس نیست؛ کمی بعد تلاش کنید.');
    const session: Session = { cookies: new Map(), csrf: '', expires: Date.now() + lifetime };
    await refreshCsrf(session);
    await upstream(session, '/admin/login', 'POST', { key: req.body.key });
    await refreshCsrf(session);
    sessions.delete(sessionId(req));
    const id = randomBytes(32).toString('hex');
    sessions.set(id, session); attempts.delete(ip);
    res.cookie(cookieName, id, { httpOnly: true, secure: production, sameSite: 'strict', path: '/api/license-management', maxAge: lifetime });
    res.json({ authenticated: true, serverUrl: embedded ? allowedOrigin : serverUrl });
  });
  router.post('/logout', async (req, res) => {
    const session = sessions.get(sessionId(req));
    clearSession(req, res);
    if (session) await upstream(session, '/admin/logout', 'POST').catch(() => undefined);
    res.sendStatus(204);
  });
  router.get('/licenses', async (req, res) => res.json(await upstream(authorized(req, res), '/admin/licenses')));
  router.get('/signing-key', async (req, res) => res.json(await upstream(authorized(req, res), '/admin/signing-key')));
  router.post('/licenses', async (req, res) => res.json(await upstream(authorized(req, res), '/admin/licenses', 'POST', req.body)));
  router.param('id', (_req, _res, next, id) => {
    if (!/^[a-zA-Z0-9-]{1,128}$/.test(id)) throw new ApiError(400, 'شناسه لایسنس معتبر نیست.');
    next();
  });
  router.put('/licenses/:id', async (req, res) => res.json(await upstream(authorized(req, res), `/admin/licenses/${req.params['id']}`, 'PUT', req.body)));
  router.post('/licenses/:id/rotate-secret', async (req, res) => res.json(await upstream(authorized(req, res), `/admin/licenses/${req.params['id']}/rotate-secret`, 'POST')));
  router.use((_req, res) => res.status(404).json({ error: 'مسیر مدیریت پیدا نشد.' }));
  router.use((error: unknown, req: Request, res: Response, _next: express.NextFunction) => {
    if (error instanceof ApiError) {
      if (error.status === 401) clearSession(req, res);
      res.status(error.status).json({ error: error.message });
    } else if (error instanceof SyntaxError || (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large')) {
      res.status(400).json({ error: 'اطلاعات درخواست معتبر نیست.' });
    } else {
      res.status(502).json({ error: 'ارتباط با سرویس لایسنس برقرار نشد؛ دوباره تلاش کنید.' });
    }
  });
  return router;
}

/** Public clinic protocol on the portfolio origin; no administrator cookies are forwarded. */
export function clinicLicenseCheckRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));
  router.post('/', async (req, res) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (process.env['LICENSE_EMBEDDED_ACTIVE'] !== 'true') return res.sendStatus(503);
    const secret = req.get('X-Installation-Secret') ?? '';
    if (secret.length < 32 || secret.length > 4096) return res.sendStatus(401);
    try {
      const result = await fetch('http://127.0.0.1:5105/api/licenses/check', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', 'X-Installation-Secret': secret, 'X-Forwarded-Proto': 'https' },
        body: JSON.stringify(req.body),
      });
      if (!result.ok) return res.sendStatus([400, 401, 429].includes(result.status) ? result.status : 503);
      return res.json(await result.json());
    } catch { return res.sendStatus(503); }
  });
  router.use((_req, res) => res.sendStatus(405));
  router.use((_error: unknown, _req: Request, res: Response, _next: express.NextFunction) => res.sendStatus(400));
  return router;
}
