// An oversized file must be refused BEFORE it is pulled into memory.
//
// `download` used to read the whole body and then measure it. An Edge isolate
// has a few hundred MB for everything it is doing, so on a large object the
// check never got to run: the isolate was OOM-killed part-way through
// `arrayBuffer()`. That takes down every other request sharing the isolate, and
// it surfaces as an unexplained 503 rather than as the oversized file it is.
//
// The assertion that matters is therefore not "it throws" — the old code threw
// too, when it survived. It is that the body is never consumed.

import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { storage } from '../../_shared/storage.ts';

const MAX = 5 * 1024 * 1024; // 5MB

/** Tracks whether anything actually read the response body. */
function fakeResponse(opts: { size: number; declare?: boolean }) {
  let bodyRead = false;
  let cancelled = false;
  const res = {
    ok: true,
    headers: new Headers(
      opts.declare === false
        ? { 'content-type': 'application/pdf' }
        : { 'content-length': String(opts.size), 'content-type': 'application/pdf' },
    ),
    get body() {
      return { cancel: () => { cancelled = true; return Promise.resolve(); } };
    },
    arrayBuffer: () => {
      bodyRead = true;
      return Promise.resolve(new ArrayBuffer(opts.size));
    },
    text: () => Promise.resolve(''),
  };
  return {
    res: res as unknown as Response,
    wasBodyRead: () => bodyRead,
    wasCancelled: () => cancelled,
  };
}

function withFetch<T>(res: Response, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(res);
  return fn().finally(() => { globalThis.fetch = original; });
}

function setEnv() {
  Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
}

Deno.test('an over-limit file is rejected without its body being read', async () => {
  setEnv();
  const fake = fakeResponse({ size: 200 * 1024 * 1024 }); // 200MB
  await withFetch(fake.res, async () => {
    await assertRejects(
      () => storage.download('someone/huge.pdf', MAX),
      Error,
      'over the',
    );
  });
  assert(!fake.wasBodyRead(), 'arrayBuffer() must never be called on an oversized object');
  assert(fake.wasCancelled(), 'the abandoned stream must be cancelled, not left downloading');
});

Deno.test('a file within the limit is downloaded normally', async () => {
  setEnv();
  const fake = fakeResponse({ size: 1024 });
  const out = await withFetch(fake.res, () => storage.download('someone/small.pdf', MAX));
  assertEquals(out.bytes.byteLength, 1024);
  assertEquals(out.mimeType, 'application/pdf');
  assert(fake.wasBodyRead());
});

Deno.test('a missing Content-Length still cannot smuggle an oversized body through', async () => {
  // Content-Length is advisory: it can be absent on a chunked response, or wrong.
  // The post-read check is the backstop, so it must survive the header being gone.
  setEnv();
  const fake = fakeResponse({ size: 20 * 1024 * 1024, declare: false });
  await withFetch(fake.res, async () => {
    await assertRejects(() => storage.download('someone/chunked.pdf', MAX), Error, 'over the');
  });
  assert(fake.wasBodyRead(), 'without a header there is nothing to check but the body');
});
