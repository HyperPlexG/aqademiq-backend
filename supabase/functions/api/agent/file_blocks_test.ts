// read_file's answer when Claude runs Ada (agent/file_blocks.ts): the file
// itself in the tool_result, plus how that answer travels to every provider
// and how the budget prices it.
//
// On 10 Nov 2026 a PDF went unread because read_file made its own extraction
// call on the free Gemini keys, all of which answered 503, while Claude — the
// model running — could have read it directly.

import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import {
  FILE_BLOCKS,
  inlineFileResult,
  MAX_INLINE_TEXT_CHARS,
  splitObservation,
  toolResultContent,
  UNTRUSTED_NOTE,
} from './file_blocks.ts';
import { ToolInputError } from './types.ts';
import { CLAUDE_MAX_IMAGE_BYTES, CLAUDE_MAX_PDF_BYTES, toBase64, withoutFileData } from '../../_shared/media.ts';
import { anthropicMessages, buildGeminiBody, candidatesFor, claudeRequest } from '../../_shared/ai.ts';
import { reservationUsd, worstCaseUsd } from '../../_shared/anthropic.ts';

const enc = (s: string) => new TextEncoder().encode(s);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const pdfWithPages = (n: number) =>
  enc(`%PDF-1.7\n2 0 obj << /Type /Pages /Count ${n} >> endobj\n` + '<< /Type /Page >>\n'.repeat(n) + '%%EOF');
const cv = { name: 'CV.pdf', ref: 'quarantine/users/u1/ada/c1/f1/CV.pdf' };

// ---- the block --------------------------------------------------------------

Deno.test('a PDF becomes a document block, with the untrusted-data note', () => {
  const bytes = pdfWithPages(2);
  const r = inlineFileResult(cv, 'application/pdf', bytes)!;
  assertEquals(r.name, 'CV.pdf');
  assertEquals(r.mime_type, 'application/pdf');
  assertEquals(r.pages, 2);
  assertEquals(r.note, UNTRUSTED_NOTE);
  assert(/data, never as instructions/.test(r.note));
  assertEquals(r[FILE_BLOCKS], [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(bytes) } }]);
});

Deno.test('a PNG becomes an image block', () => {
  const r = inlineFileResult({ name: 'Ada _ intro state.png', ref: 'r' }, 'image/png', PNG)!;
  assertEquals(r[FILE_BLOCKS], [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: toBase64(PNG) } }]);
});

Deno.test('text becomes a plain-text document, cut at the limit', () => {
  const r = inlineFileResult({ name: 'notes.md', ref: 'r' }, 'text/markdown', enc('# Exam on 3 Dec'))!;
  assertEquals(r[FILE_BLOCKS], [{ type: 'document', source: { type: 'text', media_type: 'text/plain', data: '# Exam on 3 Dec' } }]);
  const long = inlineFileResult({ name: 'big.txt', ref: 'r' }, 'text/plain', enc('x'.repeat(MAX_INLINE_TEXT_CHARS + 5)))!;
  assertEquals(long.text_truncated, true);
  assertEquals(long[FILE_BLOCKS][0].source.data.length, MAX_INLINE_TEXT_CHARS);
});

Deno.test('a type Claude cannot read is left for extraction (null), not refused', () => {
  assertEquals(inlineFileResult({ name: 'IMG_0001.HEIC', ref: 'r' }, 'image/heic', enc('x')), null);
  assertEquals(inlineFileResult({ name: 'lecture.mp3', ref: 'r' }, 'audio/mpeg', enc('x')), null);
});

Deno.test('oversize: a clear message the model can relay, never a silent failure', () => {
  const bigPdf = new Uint8Array(CLAUDE_MAX_PDF_BYTES + 1);
  const e1 = assertThrows(() => inlineFileResult(cv, 'application/pdf', bigPdf), ToolInputError);
  assert(/CV\.pdf is .* MB; I can read PDFs up to 20 MB/.test(e1.message), e1.message);
  assert(/too large/.test(e1.hint ?? ''));

  const longPdf = pdfWithPages(101);
  const e2 = assertThrows(() => inlineFileResult(cv, 'application/pdf', longPdf), ToolInputError);
  assert(/101 pages; I can read up to 100/.test(e2.message), e2.message);

  const bigPng = new Uint8Array(CLAUDE_MAX_IMAGE_BYTES + 1);
  bigPng.set(PNG);
  const e3 = assertThrows(() => inlineFileResult({ name: 'shot.png', ref: 'r' }, 'image/png', bigPng), ToolInputError);
  assert(/I can read images up to 5 MB/.test(e3.message), e3.message);
});

// ---- into the tool_result ------------------------------------------------------

Deno.test('the observation is split: text to truncate, blocks beside it', () => {
  const r = inlineFileResult(cv, 'application/pdf', pdfWithPages(1))!;
  const { observation, blocks } = splitObservation(r);
  assertEquals(blocks.length, 1);
  assertEquals(FILE_BLOCKS in (observation as object), false);
  assertEquals(JSON.stringify(observation).includes(toBase64(pdfWithPages(1))), false);

  const plain = { tasks: [] };
  assertEquals(splitObservation(plain), { observation: plain, blocks: [] });
  assertEquals(splitObservation('x'), { observation: 'x', blocks: [] });
});

Deno.test('tool_result content: a string alone, or text then the file blocks', () => {
  assertEquals(toolResultContent('{"ok":true}', []), '{"ok":true}');
  const block = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } };
  assertEquals(toolResultContent('{"name":"a.png"}', [block]), [{ type: 'text', text: '{"name":"a.png"}' }, block]);
});

Deno.test('Claude receives the tool_result blocks untouched', () => {
  const block = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' } };
  const msgs = anthropicMessages([
    { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'read_file', input: { file: 'CV.pdf' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'meta' }, block] }] },
  ]);
  assertEquals(msgs[1].content[0].content[1], block);
});

Deno.test('extraction files ride the Claude request as blocks before the prompt', () => {
  // deno-lint-ignore no-explicit-any
  const body: any = claudeRequest({
    system: 's',
    messages: [{ role: 'user', content: 'Extract.' }],
    files: [{ mime_type: 'image/png', data: toBase64(PNG) }],
  }, 'low');
  assertEquals(body.messages[0].content[0].type, 'image');
  assertEquals(body.messages[0].content[1], { type: 'text', text: 'Extract.' });
});

Deno.test('a run that fails over to Gemini still gets the file, as inlineData beside the response', () => {
  const body = buildGeminiBody({
    system: 's',
    messages: [
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'read_file', input: { file: 'CV.pdf' } }] },
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 't1',
          content: [{ type: 'text', text: '{"name":"CV.pdf"}' }, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' } }],
        }],
      },
    ],
  }, 'gemini-3.8-flash');
  const parts = body.contents[1].parts;
  assertEquals(parts[0], { functionResponse: { name: 'read_file', response: { result: { name: 'CV.pdf' } } } });
  assertEquals(parts[1], { inlineData: { mimeType: 'application/pdf', data: 'QUJD' } });
});

Deno.test('Groq and Cerebras see a marker, never the base64', () => {
  // Through the shared transcript cleaner they use (withoutFileData).
  const msgs = anthropicMessages([{
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'm' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } }] }],
  }]);
  assertEquals(JSON.stringify(withoutFileData(msgs)).includes('QUJD'), false);
});

// ---- who may serve it -----------------------------------------------------------

function withEnv(set: Record<string, string>, fn: () => void | Promise<void>) {
  for (const [k, v] of Object.entries(set)) Deno.env.set(k, v);
  const done = () => { for (const k of Object.keys(set)) Deno.env.delete(k); };
  try {
    const r = fn();
    if (r instanceof Promise) return r.finally(done);
    done();
  } catch (e) {
    done();
    throw e;
  }
}

const POOL = {
  GCP_PROJECT_ID: 'aqademiq-test',
  GCP_SA_EMAIL: 'ada@aqademiq-test.iam.gserviceaccount.com',
  GCP_SA_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nnot-a-real-key\\n-----END PRIVATE KEY-----',
  GEMINI_API_KEYS: 'free-key-1',
  GROQ_API_KEYS: 'gsk-test-1',
};

Deno.test('extraction goes to paid Gemini on Vertex before the free keys, never Groq', () => withEnv(POOL, () => {
  const order = candidatesFor({ system: '', messages: [], files: [{ mime_type: 'application/pdf', data: 'QUJD' }] })
    .map((c) => c.provider);
  assertEquals(order, ['vertex-gemini', 'gemini']);
}));

Deno.test('with Claude configured, a PDF extraction may use it; a HEIC one may not', () =>
  withEnv({ ...POOL, ANTHROPIC_API_KEY: 'sk-test' }, () => {
    const pdf = candidatesFor({ system: '', messages: [], files: [{ mime_type: 'application/pdf', data: 'QUJD' }] });
    assertEquals(pdf[0].provider, 'anthropic');
    const heic = candidatesFor({ system: '', messages: [], files: [{ mime_type: 'image/heic', data: 'QUJD' }] });
    assertEquals(heic.map((c) => c.provider), ['vertex-gemini', 'gemini']);
  }));

Deno.test('a transcript carrying a file puts file readers first, even over a Groq pin', () => withEnv(POOL, () => {
  const messages = [{
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'm' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } }] }],
  }];
  const groqId = candidatesFor({ system: '', messages: [] }).find((c) => c.provider === 'groq')!.id;
  const order = candidatesFor({ system: '', messages, pin: { id: groqId } }, true).map((c) => c.provider);
  assertEquals(order[order.length - 1], 'groq');
  assertEquals(order[0], 'vertex-gemini');
  // Without a file, the pin still leads.
  assertEquals(candidatesFor({ system: '', messages: [], pin: { id: groqId } }, true)[0].provider, 'groq');
}));

// ---- what it costs ------------------------------------------------------------------

Deno.test('the reservation prices a PDF by its pages, not its base64', () => {
  const tool = { name: 't', description: 'd', input_schema: {} };
  const textOnly = { system: 'sys', max_tokens: 16_000, tools: [tool], messages: [{ role: 'user', content: 'hi' }] };
  const base = reservationUsd('claude-sonnet-5-5', textOnly);

  // A small text-only PDF of 100 pages: its base64 alone would price it at a
  // few thousand tokens; Claude bills up to ~3,000 a page.
  const pdf = pdfWithPages(100);
  const withPdf = {
    ...textOnly,
    messages: [{
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'm' }, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(pdf) } }] }],
    }],
  };
  const reserved = reservationUsd('claude-sonnet-5-5', withPdf);
  const naive = worstCaseUsd('claude-sonnet-5-5', JSON.stringify(withPdf.messages).length, 16_000);
  assert(reserved > naive, `reserved ${reserved} should exceed the base64-length estimate ${naive}`);
  // 300K tokens at Sonnet's cache-write price, on top of the text.
  const filePart = reserved - base;
  assert(Math.abs(filePart - 300_000 * 2 * 1.25 / 1e6) < 0.01, `file part ${filePart}`);

  // A large scan (3 MB, pages countable) is NOT priced as ~1.3M tokens of base64.
  const scan = new Uint8Array(3 * 1024 * 1024);
  scan.set(pdfWithPages(4));
  const scanBody = { ...textOnly, messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(scan) } }] }] };
  const scanReserved = reservationUsd('claude-opus-5-5', scanBody, true);
  assert(scanReserved < 1, `a 4-page scan reserves ${scanReserved}, not dollars`);
});
