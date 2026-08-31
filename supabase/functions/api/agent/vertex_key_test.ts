// A service-account key has to survive the journey into a secret store.
//
// It is copied out of JSON, pushed through a shell or a web form, and stored —
// and each of those changes it differently. Vertex was configured and deployed
// for two days while every single call failed on
// `"pkcs8" must be PKCS#8 formatted string`, the free keys quietly covered, and
// the only symptom was unexplained latency. The parser now accepts every
// encoding that round-trips to the same key rather than demanding one.
//
// The base64 here is not a real key — these assert the SHAPE the normaliser
// produces, which is what `importPKCS8` is strict about.

import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { normalizePrivateKey } from '../../_shared/vertex.ts';

const HEADER = '-----BEGIN PRIVATE KEY-----';
const FOOTER = '-----END PRIVATE KEY-----';
/** 130 chars, so it must wrap onto three lines at 64 columns. */
const BODY = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDaBcDeFgHiJkLm' +
  'NoPqRsTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXy' +
  'ZaBc';

const canonical = `${HEADER}\n${BODY.slice(0, 64)}\n${BODY.slice(64, 128)}\n${BODY.slice(128)}\n${FOOTER}\n`;

Deno.test('an already-correct PEM is returned unchanged', () => {
  assertEquals(normalizePrivateKey(canonical), canonical);
});

Deno.test('the two-character \\n escape becomes real newlines', () => {
  // What a JSON copy gives you: the key as it appears in the credentials file.
  const escaped = `${HEADER}\\n${BODY.slice(0, 64)}\\n${BODY.slice(64, 128)}\\n${BODY.slice(128)}\\n${FOOTER}`;
  assertEquals(normalizePrivateKey(escaped), canonical);
});

Deno.test('a key flattened onto one line is re-wrapped', () => {
  // What a dashboard textarea does — and what actually happened in production.
  const flat = `${HEADER} ${BODY} ${FOOTER}`;
  const out = normalizePrivateKey(flat);
  assertEquals(out, canonical);
  // The wrap is the part importPKCS8 is strict about.
  const lines = out.trim().split('\n');
  assertEquals(lines[0], HEADER);
  assertEquals(lines[lines.length - 1], FOOTER);
  assert(lines.slice(1, -1).every((l) => l.length <= 64));
});

Deno.test('surrounding quotes from a shell assignment are stripped', () => {
  assertEquals(normalizePrivateKey(`"${canonical.trim()}"`), canonical);
  assertEquals(normalizePrivateKey(`'${canonical.trim()}'`), canonical);
});

Deno.test('stray whitespace and CRLF do not matter', () => {
  const messy = `  ${HEADER}\r\n${BODY.slice(0, 40)}\r\n  ${BODY.slice(40)}  \r\n${FOOTER}  `;
  assertEquals(normalizePrivateKey(messy), canonical);
});

Deno.test('a value that is not a PEM fails with a message about the key', () => {
  // Not "must be PKCS#8 formatted string" — that sent us looking at whitespace
  // when the real answer was that the secret held something else entirely.
  assertThrows(
    () => normalizePrivateKey('not-a-key'),
    Error,
    'no BEGIN/END PRIVATE KEY markers',
  );
});

Deno.test('an empty body is rejected rather than handed to importPKCS8', () => {
  assertThrows(() => normalizePrivateKey(`${HEADER}\n\n${FOOTER}`), Error, 'empty PEM body');
});
