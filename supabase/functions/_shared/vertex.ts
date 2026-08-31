// Claude on Vertex AI from Deno — replaces @anthropic-ai/vertex-sdk, whose
// google-auth-library ADC discovery is Node-only and cannot run in the Edge
// Function sandbox. Auth is done by hand: sign a service-account JWT with Web
// Crypto (jose), exchange it for an OAuth2 access token, then call the
// rawPredict / streamRawPredict REST endpoints with fetch.
//
// Required secrets (supabase secrets set ...):
//   GCP_PROJECT_ID       — GCP project with Vertex AI + Claude model access
//   GCP_SA_EMAIL         — service account email (roles/aiplatform.user)
//   GCP_SA_PRIVATE_KEY   — the SA's private_key field (PKCS8 PEM); literal
//                          "\n" escapes are normalized
//   VERTEX_REGION        — e.g. us-east5 (default) or "global"
//   CLAUDE_OPUS_MODEL / CLAUDE_HAIKU_MODEL — Vertex model ids incl. @version

import { SignJWT, importPKCS8 } from 'npm:jose@5';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

let cached: { token: string; expiresAt: number } | null = null;

export function isVertexConfigured(): boolean {
  return Boolean(
    Deno.env.get('GCP_PROJECT_ID') && Deno.env.get('GCP_SA_EMAIL') && Deno.env.get('GCP_SA_PRIVATE_KEY'),
  );
}

/**
 * OAuth2 access token for the service account, cached until a minute before it
 * expires.
 *
 * Exported because Gemini on Vertex (`_shared/ai.ts`) authenticates exactly the
 * same way — same service account, same scope, same token. Minting a second one
 * would double the token-exchange round trips for no benefit, and each is a full
 * RSA sign plus an HTTP call on a cold isolate.
 */
export async function gcpAccessToken(): Promise<string> {
  return accessToken();
}

/** GCP project id, or throws with the name of the secret that is missing. */
export function gcpProject(): string {
  const project = Deno.env.get('GCP_PROJECT_ID');
  if (!project) throw new Error('Vertex is not configured (GCP_PROJECT_ID)');
  return project;
}

/** `https://<host>` for a Vertex region, handling the special `global` case. */
export function vertexHost(region: string): string {
  return region === 'global' ? 'https://aiplatform.googleapis.com' : `https://${region}-aiplatform.googleapis.com`;
}

const PEM_HEADER = '-----BEGIN PRIVATE KEY-----';
const PEM_FOOTER = '-----END PRIVATE KEY-----';

/**
 * Rebuild a PKCS#8 PEM from however the secret store mangled it.
 *
 * `importPKCS8` wants the canonical form — header, base64 wrapped at 64
 * columns, footer — and rejects anything else with the unhelpful
 * `"pkcs8" must be PKCS#8 formatted string`. A service-account key has to
 * survive being copied out of JSON, through a shell or a web form, and into a
 * secret store, and each of those can change it in a different way:
 *
 *   - a dashboard textarea can flatten it to a single line, losing every newline
 *   - a JSON copy keeps the two-character escape `\n` rather than a real newline
 *   - a shell can leave the surrounding quotes attached to the value
 *
 * All three produce the same failure, and it took a silent fallback and a
 * deployed logging fix to see it at all. So rather than demand one exact
 * encoding, strip the body down to its base64 and re-wrap it. Every variant
 * above converges on the same key, and a genuinely wrong value still fails —
 * just in `importPKCS8`, where the message is about the key rather than about
 * whitespace.
 */
export function normalizePrivateKey(raw: string): string {
  let pem = raw.replace(/\\n/g, '\n').trim();
  // A quoted value stored verbatim, e.g. from `KEY="-----BEGIN..."`.
  if ((pem.startsWith('"') && pem.endsWith('"')) || (pem.startsWith("'") && pem.endsWith("'"))) {
    pem = pem.slice(1, -1).trim();
  }
  const start = pem.indexOf(PEM_HEADER);
  const end = pem.indexOf(PEM_FOOTER);
  if (start === -1 || end === -1) {
    throw new Error('GCP_SA_PRIVATE_KEY is not a PEM private key (no BEGIN/END PRIVATE KEY markers)');
  }
  // Everything between the markers, with ALL whitespace removed — that is the
  // base64 body regardless of how it was wrapped, or whether it was wrapped.
  const body = pem.slice(start + PEM_HEADER.length, end).replace(/\s+/g, '');
  if (!body) throw new Error('GCP_SA_PRIVATE_KEY has empty PEM body');
  const wrapped = body.match(/.{1,64}/g)!.join('\n');
  return `${PEM_HEADER}\n${wrapped}\n${PEM_FOOTER}\n`;
}

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  const saEmail = Deno.env.get('GCP_SA_EMAIL');
  const rawPem = Deno.env.get('GCP_SA_PRIVATE_KEY');
  if (!saEmail || !rawPem) throw new Error('Vertex is not configured (GCP_SA_EMAIL / GCP_SA_PRIVATE_KEY)');
  const pem = normalizePrivateKey(rawPem);

  const key = await importPKCS8(pem, 'RS256');
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(saEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`Vertex token exchange failed (${res.status}): ${await res.text()}`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

function modelUrl(model: string, stream: boolean): string {
  const project = Deno.env.get('GCP_PROJECT_ID');
  if (!project) throw new Error('Vertex is not configured (GCP_PROJECT_ID)');
  const region = Deno.env.get('VERTEX_REGION') ?? 'us-east5';
  const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
  const verb = stream ? 'streamRawPredict' : 'rawPredict';
  return `https://${host}/v1/projects/${project}/locations/${region}/publishers/anthropic/models/${model}:${verb}`;
}

/** Anthropic Messages request; `model` is a Vertex id (goes in the URL, not the body). */
export interface VertexMessagesParams {
  model: string;
  max_tokens: number;
  messages: unknown[];
  system?: unknown;
  temperature?: number;
  tools?: unknown[];
  [extra: string]: unknown;
}

export async function vertexMessages({ model, ...body }: VertexMessagesParams): Promise<unknown> {
  const res = await fetch(modelUrl(model, false), {
    method: 'POST',
    headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ anthropic_version: 'vertex-2023-10-16', ...body }),
  });
  if (!res.ok) throw new Error(`Vertex rawPredict failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/** SSE passthrough for Ada chat streaming — caller forwards res.body to the client. */
export async function vertexMessagesStream({ model, ...body }: VertexMessagesParams): Promise<Response> {
  const res = await fetch(modelUrl(model, true), {
    method: 'POST',
    headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ anthropic_version: 'vertex-2023-10-16', stream: true, ...body }),
  });
  if (!res.ok) throw new Error(`Vertex streamRawPredict failed (${res.status}): ${await res.text()}`);
  return res;
}
