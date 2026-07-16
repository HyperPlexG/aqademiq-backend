// Supabase Edge Function: main API — Hono port of the NestJS backend.
//
// URL shape: https://<ref>.supabase.co/functions/v1/api/v1/<resource>
// The Flutter client keeps its `/v1/<resource>` wire contract unchanged; only
// its base URL moves, to  https://<ref>.supabase.co/functions/v1/api

import { Hono } from 'npm:hono@4';
import { importSPKI, jwtVerify } from 'npm:jose@5';
import { RequestContext, type RequestIdentity } from '../_shared/context.ts';
import { HttpError, errorBody } from '../_shared/http.ts';

const app = new Hono().basePath('/api/v1');

// ---- auth guard — port of common/guards/jwt-auth.guard.ts ----
// Paths listed here mirror @Public() decorations in the Nest app; the
// /auth/* public routes join this set as the auth module is ported.
const PUBLIC_PATHS = new Set(['/healthz', '/readyz']);

// PEM content, not a file path — Edge Functions have no key files to mount.
const publicKeyPem = Deno.env.get('JWT_PUBLIC_KEY');
const publicKey = publicKeyPem ? await importSPKI(publicKeyPem, 'RS256') : null;

app.use('*', async (c, next) => {
  const path = c.req.path.replace(/^\/api\/v1/, '');
  if (PUBLIC_PATHS.has(path)) return next();
  if (!publicKey) throw new HttpError(500, 'JWT_PUBLIC_KEY is not configured');

  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Missing bearer token');

  let claims: Record<string, unknown>;
  try {
    ({ payload: claims } = await jwtVerify(token, publicKey, {
      issuer: 'aqademiq',
      audience: 'aqademiq-app',
    }));
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  // TODO(migration): deny-list check (auth:deny:{sid}) via Upstash REST —
  // ports the Redis revocation half of token.service.ts verifyAccess().

  const identity: RequestIdentity = {
    userId: String(claims.sub),
    isGuest: claims.is_guest === true,
    sessionId: String(claims.sid ?? ''),
  };
  return RequestContext.run(identity, () => next());
});

// ---- routes ----
app.get('/healthz', (c) => c.json({ status: 'ok' }));

// TODO(migration): ping Postgres and Upstash once wired (port of health.controller.ts readyz).
app.get('/readyz', (c) => c.json({ status: 'ok' }));

// TODO(migration): mount feature routers here as modules are ported, e.g.
//   app.route('/auth', authRouter);
//   app.route('/tasks', tasksRouter);

// ---- uniform error shape — port of common/filters/http-exception.filter.ts ----
app.notFound((c) => c.json(errorBody(404, 'Not found', c.req.path), 404));

app.onError((err, c) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : 'Internal server error';
  const errors = err instanceof HttpError ? err.errors : undefined;
  if (status >= 500) console.error(`${c.req.method} ${c.req.path} -> ${status}`, err);
  // deno-lint-ignore no-explicit-any
  return c.json(errorBody(status, message, c.req.path, errors), status as any);
});

Deno.serve(app.fetch);
