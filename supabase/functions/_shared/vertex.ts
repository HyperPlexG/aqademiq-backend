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

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  const saEmail = Deno.env.get('GCP_SA_EMAIL');
  const pem = Deno.env.get('GCP_SA_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  if (!saEmail || !pem) throw new Error('Vertex is not configured (GCP_SA_EMAIL / GCP_SA_PRIVATE_KEY)');

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
