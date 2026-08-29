// Which account pays for Ada.
//
// The pool decides that, and the decision is invisible at runtime: every
// provider returns the same Anthropic-shaped result, so a run served by the
// wrong one looks identical in the logs and only shows up on a bill.
//
// Two specific mistakes are worth guarding:
//
//  1. Vertex not leading. The GCP credits exist to be spent; if the free keys
//     came first, Vertex would only ever be reached once the free tier was
//     exhausted, which is the opposite of the intent.
//  2. Free keys dropping out. They are the fallback for the day the credits run
//     dry or billing breaks. A pool that contains ONLY Vertex takes Ada down
//     with the credit balance.
//
// Note what is deliberately NOT asserted here: that Gemini-on-Vertex is billed
// to `publishers/google`. That lives in the URL built by `vertexGeminiChat`, and
// reaching it needs a real signed service-account token. The comment in
// `_shared/claude.ts` carries the warning instead — Claude on Vertex is a
// Marketplace product and is the thing credits typically will not pay for.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { orderedCandidates } from '../../_shared/ai.ts';

/** A syntactically valid but non-functional SA config — nothing here is called. */
function setVertexEnv() {
  Deno.env.set('GCP_PROJECT_ID', 'aqademiq-test');
  Deno.env.set('GCP_SA_EMAIL', 'ada@aqademiq-test.iam.gserviceaccount.com');
  Deno.env.set('GCP_SA_PRIVATE_KEY', '-----BEGIN PRIVATE KEY-----\\nnot-a-real-key\\n-----END PRIVATE KEY-----');
}

function clearVertexEnv() {
  Deno.env.delete('GCP_PROJECT_ID');
  Deno.env.delete('GCP_SA_EMAIL');
  Deno.env.delete('GCP_SA_PRIVATE_KEY');
}

function setFreeKeys() {
  Deno.env.set('GEMINI_API_KEYS', 'free-key-1,free-key-2');
  Deno.env.set('GROQ_API_KEYS', 'gsk-test-1');
}

function clearFreeKeys() {
  Deno.env.delete('GEMINI_API_KEYS');
  Deno.env.delete('GROQ_API_KEYS');
}

function reset() {
  clearVertexEnv();
  clearFreeKeys();
  Deno.env.delete('VERTEX_GEMINI_MODEL');
  Deno.env.delete('VERTEX_GEMINI_MODELS');
}

Deno.test('Vertex leads the pool when the GCP secrets are set', () => {
  reset();
  setVertexEnv();
  setFreeKeys();
  try {
    const order = orderedCandidates();
    assertEquals(order[0].provider, 'vertex-gemini', 'credits must be spent before the free tier');
  } finally {
    reset();
  }
});

Deno.test('the free keys survive behind Vertex as a fallback', () => {
  reset();
  setVertexEnv();
  setFreeKeys();
  try {
    const providers = orderedCandidates().map((c) => c.provider);
    assert(providers.includes('gemini'), 'free Gemini keys must remain reachable');
    assert(providers.includes('groq'), 'Groq must remain reachable');
    // Order, not just presence: every Vertex entry before every free one.
    const lastVertex = providers.lastIndexOf('vertex-gemini');
    const firstFree = providers.findIndex((p) => p !== 'vertex-gemini');
    assert(lastVertex < firstFree, `expected all Vertex entries first, got ${providers.join(',')}`);
  } finally {
    reset();
  }
});

Deno.test('without the GCP secrets the pool is exactly as it was', () => {
  reset();
  setFreeKeys();
  try {
    const providers = orderedCandidates().map((c) => c.provider);
    assert(!providers.includes('vertex-gemini'), 'Vertex must not appear unconfigured');
    assertEquals(providers[0], 'gemini', 'free Gemini stays first when Vertex is absent');
  } finally {
    reset();
  }
});

Deno.test('Vertex alone is a valid pool', () => {
  // Deploying with only GCP credentials must work — the free keys are optional.
  reset();
  setVertexEnv();
  try {
    const order = orderedCandidates();
    assert(order.length > 0, 'Vertex alone must still produce a usable pool');
    assert(order.every((c) => c.provider === 'vertex-gemini'));
  } finally {
    reset();
  }
});

Deno.test('Vertex contributes one entry per model, not per key', () => {
  // One service account serves everything, so there is nothing to rotate across.
  reset();
  setVertexEnv();
  Deno.env.set('VERTEX_GEMINI_MODELS', 'gemini-2.5-flash,gemini-2.5-flash-lite');
  try {
    const vertex = orderedCandidates().filter((c) => c.provider === 'vertex-gemini');
    assertEquals(vertex.length, 2);
    assertEquals(vertex.map((c) => c.model).sort(), ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
    // Distinct ids matter: the cooldown bench is keyed on id, so two models
    // sharing one would bench both when only one hit its quota.
    assertEquals(new Set(vertex.map((c) => c.id)).size, 2);
  } finally {
    reset();
  }
});

Deno.test('the default Vertex model is the cheap tool-capable one', () => {
  reset();
  setVertexEnv();
  try {
    const vertex = orderedCandidates().filter((c) => c.provider === 'vertex-gemini');
    assertEquals(vertex.length, 1);
    assertEquals(vertex[0].model, 'gemini-2.5-flash');
  } finally {
    reset();
  }
});
