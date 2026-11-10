// What a file really is (_shared/media.ts), and how it is handed to each model.
//
// The bug this guards: the iOS picker gives no MIME, so the app uploaded a CV
// PDF and a PNG as `application/octet-stream`, and Ada refused both as "a
// format I can't open". The label is a hint; the bytes and the name decide.

import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import {
  base64Bytes,
  blockTokenEstimate,
  claudeAccepts,
  claudeFileBlocks,
  geminiAccepts,
  geminiFileParts,
  hasFileBlocks,
  IMAGE_TOKENS,
  inferMime,
  isGenericMime,
  mediaAwarePromptSize,
  mimeFromName,
  normalizeMime,
  PDF_MAX_PAGES,
  PDF_TOKENS_PER_PAGE,
  pdfPageCount,
  resolveMime,
  sniffMime,
  toBase64,
  withClaudeFiles,
  withoutFileData,
} from '../../_shared/media.ts';

const enc = (s: string) => new TextEncoder().encode(s);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const PDF = enc('%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
  '2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj\n' +
  '3 0 obj << /Type /Page /Parent 2 0 R >> endobj\n4 0 obj << /Type /Page /Parent 2 0 R >> endobj\n%%EOF');

// ---- inference --------------------------------------------------------------

Deno.test('generic labels say nothing', () => {
  for (const m of [null, undefined, '', 'application/octet-stream', 'Application/Octet-Stream; charset=binary', 'binary/octet-stream']) {
    assert(isGenericMime(m), String(m));
  }
  assertEquals(isGenericMime('application/pdf'), false);
});

Deno.test('labels are normalised: case, parameters and aliases', () => {
  assertEquals(normalizeMime('IMAGE/JPG'), 'image/jpeg');
  assertEquals(normalizeMime('application/pdf; name="cv.pdf"'), 'application/pdf');
  assertEquals(normalizeMime('application/x-pdf'), 'application/pdf');
  assertEquals(normalizeMime('  '), null);
});

Deno.test('the extension names the type, case-insensitively', () => {
  assertEquals(mimeFromName('Ada _ intro state.png'), 'image/png');
  assertEquals(mimeFromName('CV FINAL.PDF'), 'application/pdf');
  assertEquals(mimeFromName('photo.JPEG'), 'image/jpeg');
  assertEquals(mimeFromName('notes.md'), 'text/markdown');
  assertEquals(mimeFromName('essay.docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assertEquals(mimeFromName('README'), null);
  assertEquals(mimeFromName('trailing.'), null);
  assertEquals(mimeFromName(null), null);
});

Deno.test('a specific label wins over the name; a generic one gives way to it', () => {
  assertEquals(inferMime('application/pdf', 'scan.png'), 'application/pdf');
  assertEquals(inferMime('application/octet-stream', 'CV.pdf'), 'application/pdf');
  assertEquals(inferMime(null, 'Ada _ intro state.png'), 'image/png');
  assertEquals(inferMime(undefined, 'mystery'), null);
});

Deno.test('magic bytes: PDF, PNG, JPEG, GIF, WebP, HEIC', () => {
  assertEquals(sniffMime(PDF), 'application/pdf');
  // A PDF header after some junk still counts (allowed within 1024 bytes).
  assertEquals(sniffMime(enc('\r\n\r\n%PDF-1.4 ...')), 'application/pdf');
  assertEquals(sniffMime(PNG), 'image/png');
  assertEquals(sniffMime(JPEG), 'image/jpeg');
  assertEquals(sniffMime(enc('GIF89a....')), 'image/gif');
  assertEquals(sniffMime(enc('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assertEquals(sniffMime(enc('\0\0\0\x18ftypheic\0\0\0\0')), 'image/heic');
  assertEquals(sniffMime(enc('just some text')), null);
  assertEquals(sniffMime(new Uint8Array()), null);
});

Deno.test('resolveMime: the bytes beat every label, then a specific label, then the name', () => {
  // The two TestFlight reports: uploaded as octet-stream from iOS.
  assertEquals(resolveMime({ bytes: PDF, declared: null, storage: 'application/octet-stream', name: 'CV.pdf' }), 'application/pdf');
  assertEquals(resolveMime({ bytes: PNG, declared: 'application/octet-stream', name: 'Ada _ intro state.png' }), 'image/png');
  // A PNG mislabelled as JPEG: Claude rejects an image whose bytes disagree.
  assertEquals(resolveMime({ bytes: PNG, declared: 'image/jpeg', name: 'x.jpg' }), 'image/png');
  // No signature: the label, then storage's, then the name.
  assertEquals(resolveMime({ bytes: enc('hello'), declared: 'text/plain', name: 'a.md' }), 'text/plain');
  assertEquals(resolveMime({ bytes: enc('hello'), declared: null, storage: 'application/octet-stream', name: 'a.md' }), 'text/markdown');
  assertEquals(resolveMime({ bytes: enc('hello'), declared: null, storage: 'text/csv', name: 'a' }), 'text/csv');
  assertEquals(resolveMime({ bytes: enc('hello'), name: 'mystery' }), 'application/octet-stream');
});

// ---- what each model takes ----------------------------------------------------

Deno.test('Claude takes PDFs, the four image types and text; Gemini also takes HEIC, audio and video', () => {
  const f = (mime_type: string) => ({ mime_type, data: toBase64(enc('x')) });
  for (const m of ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain']) {
    assert(claudeAccepts(f(m)), m);
    assert(geminiAccepts(f(m)), m);
  }
  for (const m of ['image/heic', 'audio/mpeg', 'video/mp4']) {
    assertEquals(claudeAccepts(f(m)), false, m);
    assert(geminiAccepts(f(m)), m);
  }
  assertEquals(claudeAccepts(f('application/octet-stream')), false);
  assertEquals(geminiAccepts(f('application/msword')), false);
});

Deno.test('Claude refuses an image over 5 MB', () => {
  const big = { mime_type: 'image/png', data: 'A'.repeat(Math.ceil((5 * 1024 * 1024 + 10) * 4 / 3)) };
  assert(base64Bytes(big.data) > 5 * 1024 * 1024);
  assertEquals(claudeAccepts(big), false);
});

Deno.test('Claude blocks: PDF → document, PNG → image, text → plain-text document', () => {
  const [doc, img, txt] = claudeFileBlocks([
    { mime_type: 'application/pdf', data: toBase64(PDF) },
    { mime_type: 'image/png', data: toBase64(PNG) },
    { mime_type: 'text/markdown', data: toBase64(enc('# Week 3')) },
  ]);
  assertEquals(doc, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(PDF) } });
  assertEquals(img, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: toBase64(PNG) } });
  assertEquals(txt, { type: 'document', source: { type: 'text', media_type: 'text/plain', data: '# Week 3' } });
  assertThrows(() => claudeFileBlocks([{ mime_type: 'video/mp4', data: '' }]));
});

Deno.test('files go before the question on the last user turn', () => {
  const file = { mime_type: 'application/pdf', data: toBase64(PDF) };
  const out = withClaudeFiles([{ role: 'user', content: 'Extract this.' }], [file]);
  assertEquals(out.length, 1);
  assertEquals(out[0].content[0].type, 'document');
  assertEquals(out[0].content[1], { type: 'text', text: 'Extract this.' });
  // Not ending on a user turn: a new one is added.
  const after = withClaudeFiles([{ role: 'assistant', content: 'ok' }], [file]);
  assertEquals(after.length, 2);
  assertEquals(after[1].role, 'user');
  // No files, no change.
  const msgs = [{ role: 'user', content: 'hi' }];
  assertEquals(withClaudeFiles(msgs, undefined), msgs);
});

Deno.test('Gemini parts: bytes as inlineData, text as text', () => {
  assertEquals(geminiFileParts([{ mime_type: 'image/jpg', data: 'QUJD' }]), [{ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } }]);
  assertEquals(geminiFileParts([{ mime_type: 'text/csv', data: toBase64(enc('a,b')) }]), [{ text: 'a,b' }]);
});

// ---- what a file costs --------------------------------------------------------

Deno.test('page count from the page objects and the page tree', () => {
  assertEquals(pdfPageCount(PDF), 2);
  assertEquals(pdfPageCount(enc('%PDF-1.5 << /Type /Pages /Count 37 /Kids [] >>')), 37);
  // Pages hidden in compressed object streams: unknown, never a low guess.
  assertEquals(pdfPageCount(enc('%PDF-1.5 compressed')), null);
});

Deno.test('a file block is priced by what Claude bills, not by its base64 length', () => {
  const pdfBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(PDF) } };
  assertEquals(blockTokenEstimate(pdfBlock), 2 * PDF_TOKENS_PER_PAGE);
  // A PDF whose pages cannot be counted is priced as the most Claude reads.
  const opaque = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(enc('%PDF-1.5 x')) } };
  assertEquals(blockTokenEstimate(opaque), PDF_MAX_PAGES * PDF_TOKENS_PER_PAGE);
  assertEquals(blockTokenEstimate({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'x' } }), IMAGE_TOKENS);
  assertEquals(blockTokenEstimate({ type: 'text', text: 'hi' }), null);
});

Deno.test('the budget measures a transcript with a file in a tool_result without its base64', () => {
  const data = 'A'.repeat(3_000_000); // ~2.2 MB of image
  const messages = [
    { role: 'user', content: 'read my timetable' },
    {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: 't1',
        content: [{ type: 'text', text: '{"name":"tt.png"}' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data } }],
      }],
    },
  ];
  const size = mediaAwarePromptSize(messages);
  assertEquals(size.fileTokens, IMAGE_TOKENS);
  assert(size.textChars < 1_000, `textChars ${size.textChars}`);
  assert(hasFileBlocks(messages));
  assertEquals(hasFileBlocks([{ role: 'user', content: 'plain' }]), false);
});

Deno.test('a stored transcript keeps a marker, never the bytes', () => {
  const stripped = withoutFileData([{
    role: 'user',
    content: [{
      type: 'tool_result',
      tool_use_id: 't1',
      content: [{ type: 'text', text: 'meta' }, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' } }],
    }],
  }]);
  assertEquals(stripped[0].content[0].content[1], { type: 'text', text: '[document application/pdf omitted]' });
  assertEquals(JSON.stringify(stripped).includes('QUJD'), false);
});
