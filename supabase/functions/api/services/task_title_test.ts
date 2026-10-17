// TSK-2: `{"title": ""}` returned 201 and made a blank task. The guard lives in
// the service so every way in — the app, Ada, sync, the plan import — is held
// to it, not only the HTTP route.

import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { HttpError } from '../../_shared/http.ts';
import { cleanTitle } from './tasks.service.ts';

Deno.test('a blank title is refused', () => {
  for (const blank of ['', ' ', '\t\n ']) {
    const e = assertThrows(() => cleanTitle(blank), HttpError);
    assertEquals(e.status, 422);
  }
});

Deno.test('a real title is kept, without the stray spaces', () => {
  assertEquals(cleanTitle('  Read chapter 4 '), 'Read chapter 4');
});

Deno.test('no title at all is left for the caller to decide', () => {
  // PATCH without a title must not touch it; create requires it upstream.
  assertEquals(cleanTitle(undefined), undefined);
});
