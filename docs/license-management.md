# Portfolio license management

The portfolio exposes `/admin/licenses` and links to it from the desktop/mobile navigation and footer. This page manages the **same records** used by the clinic's signed Framework package. It does not maintain a second license database.

The portfolio's existing Express server provides a same-origin gateway at `/api/license-management`. It uses the central server's existing authenticated `/admin` endpoints and CSRF protection. No change to the clinic's check endpoint or signing protocol is required.

## Configure the deployed portfolio

Run the SSR Node server (`npm start`), not just the `browser` static output. Set these environment variables on the host and restart the portfolio:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `LICENSE_SERVER_URL` | The deployed central licensing service's HTTPS origin, e.g. `https://licenses.example.com` (no path) |
| `LICENSE_MANAGER_ORIGIN` | The exact public HTTPS origin used to open the portfolio, e.g. `https://portfolio.example.com` (no path) |
| `PORT` | The port assigned by the existing host |
| `NG_ALLOWED_HOSTS` | The portfolio hostname(s) allowed by Angular SSR, e.g. `portfolio.example.com` (comma-separated, no scheme or port) |

Both URLs must be actual configured origins. The examples are placeholders. Redirect the alternative `www`/non-`www` hostname to the configured portfolio origin. HTTPS must terminate at the trusted hosting proxy before traffic reaches Node. The browser must connect over HTTPS for the secure admin cookie.

Deploy the licensing service from `DentalDashboard-Framework/LicenseServer` separately, with its existing signing keys, SQLite database, admin key and persistent storage. Allow the portfolio server to reach it. The portfolio does not need the signing private key, database credentials, or an admin key environment variable. Enter the central service's existing admin key on the management login screen.

If configuration is missing or invalid, the management page displays an unavailable state and management requests fail closed. The public portfolio continues to work. Plain HTTP to a loopback licensing server is supported only outside production for local testing.

## Use

1. Open `/admin/licenses`, then sign in with the existing central admin key.
2. Create an installation with the clinic name, product (`dental-clinic`), exact backend environment, and expiration. Input dates use the device's local timezone and are submitted as UTC.
3. Save the one-time installation credentials. Copy the public key separately. Configure the clinic's `License` settings as documented in the backend repository; `ServerUrl` must point to the central service, not the portfolio.
4. Use **تمدید و تغییر وضعیت** to change expiry or enable/disable an installation. Revision conflicts require refreshing the list before retrying.
5. Use **تعویض رمز نصب** when required. Confirm the action, save the replacement, then update and restart the clinic using its existing deployment process. The old secret stops working on the next check.

Active/expired/disabled status, installation ID, environment, expiry, and last clinic check are shown. Filtering and searching only operate on the authorized list. Clinic checks still run every five minutes; offline signed validity and revocation behavior are unchanged.

## Sessions and data

- The admin key is submitted only during login. It is not embedded in the build or stored in browser storage.
- Upstream authentication cookies and CSRF tokens stay in server memory. The browser receives a random, HttpOnly, Secure, SameSite=Strict session cookie, scoped to the management API, with a one-hour absolute lifetime.
- Admin responses and the page are not cacheable and are marked `noindex`. Unauthenticated requests cannot read or mutate licenses.
- Mutations require an exact matching Origin and a custom request header. Only the fixed management endpoints can be proxied; arbitrary upstream URLs are not accepted.
- Sessions and failed-login counters are bounded and held in memory. Restarting the portfolio logs managers out. Use one Node instance or sticky sessions; a shared session/rate-limit store is required before scaling this admin gateway across non-sticky replicas.
- The central service retains license records and its existing audit history. The portfolio does not delete records or expose signing private keys.

## Verification

```sh
npm ci
npm run test:licensing
npm run build
```

The gateway suite checks authorization, cookies/CSRF bridging, cross-origin blocking, creation, updates, stale revisions, rotation, logout with an upstream outage, login limits, and fail-closed production configuration. Test actual service connectivity on staging before entering real clinic credentials.
