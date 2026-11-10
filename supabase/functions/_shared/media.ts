// What a file really is, and how each model is handed one.
//
// An upload's content type comes from the client, and the client does not
// always know it: the iOS file picker returns a bare path with no MIME, so the
// app sent `application/octet-stream` for every file — a CV in PDF, a PNG
// screenshot — and Ada refused them as "a format I can't open". Storage then
// echoed the same generic type back. So the label is a hint, never the truth:
//
//   1. the file's own first bytes (%PDF, the PNG/JPEG/GIF/WebP/HEIC
//      signatures) win whenever we have them, because the model APIs check
//      them too — Claude rejects an image whose bytes disagree with its
//      media_type;
//   2. then a specific declared type;
//   3. then the file name's extension;
//   4. otherwise it stays generic, and is treated as unknown.
//
// Pure (no IO, no env), so it is unit-tested directly (media_test.ts).

/** Labels that say nothing about what a file is. */
const GENERIC = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/binary',
  'application/unknown',
  'application/x-unknown',
  'application/x-download',
  'application/force-download',
  'unknown/unknown',
]);

/** Spellings that mean the same thing as a canonical type. */
const ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'application/x-pdf': 'application/pdf',
  'application/acrobat': 'application/pdf',
  'text/x-markdown': 'text/markdown',
  'audio/x-wav': 'audio/wav',
  'audio/x-m4a': 'audio/m4a',
};

const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  txt: 'text/plain',
  text: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/m4a',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** Lower-cased, parameters stripped, aliases folded. Null for nothing. */
export function normalizeMime(mime: string | null | undefined): string | null {
  if (typeof mime !== 'string') return null;
  const m = mime.toLowerCase().split(';')[0].trim();
  if (!m) return null;
  return ALIASES[m] ?? m;
}

/** True when the label carries no information (absent, octet-stream, …). */
export function isGenericMime(mime: string | null | undefined): boolean {
  const m = normalizeMime(mime);
  return m === null || GENERIC.has(m);
}

/** The type a file name's extension implies, or null. */
export function mimeFromName(name: string | null | undefined): string | null {
  if (typeof name !== 'string') return null;
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return null;
  return BY_EXTENSION[name.slice(dot + 1).toLowerCase().trim()] ?? null;
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[offset + i] !== sig[i]) return false;
  return true;
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/**
 * The type a file's first bytes prove, or null when they prove nothing we
 * recognise. Only signatures that cannot be mistaken for text are checked.
 */
export function sniffMime(bytes: Uint8Array): string | null {
  // PDF: "%PDF-". Some generators put junk first; the spec allows the header
  // anywhere in the first 1024 bytes.
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i + 5 <= head.length; i++) {
    if (startsWith(head, ascii('%PDF-'), i)) return 'application/pdf';
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return 'image/gif';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  // ISO-BMFF: "....ftyp<brand>". HEIC photos are what an iPhone camera makes.
  if (startsWith(bytes, ascii('ftyp'), 4)) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12));
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand.startsWith('M4A')) return 'audio/m4a';
    return 'video/mp4';
  }
  return null;
}

/**
 * Best type from what is known WITHOUT the bytes: a specific declared type,
 * else the extension. Null when neither says anything (it may still be
 * readable — only the bytes can tell).
 */
export function inferMime(declared: string | null | undefined, name: string | null | undefined): string | null {
  const d = normalizeMime(declared);
  if (d && !GENERIC.has(d)) return d;
  return mimeFromName(name);
}

/**
 * Best type once the bytes are in hand. The bytes win; then whatever the
 * record or storage declared, if specific; then the name. Falls back to
 * `application/octet-stream`.
 */
export function resolveMime(opts: {
  bytes?: Uint8Array | null;
  declared?: string | null;
  storage?: string | null;
  name?: string | null;
}): string {
  const sniffed = opts.bytes ? sniffMime(opts.bytes) : null;
  if (sniffed) return sniffed;
  return inferMime(opts.declared, null) ?? inferMime(opts.storage, opts.name) ?? 'application/octet-stream';
}

// ---- what each model takes -----------------------------------------------

/** A file sent inline with the final user turn: its type and base64 bytes. */
export interface InlineFile {
  mime_type: string;
  /** base64, no data: prefix. */
  data: string;
}

/** Image types Claude accepts as `image` blocks. */
export const CLAUDE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const CLAUDE_IMAGE = CLAUDE_IMAGE_TYPES;
/** Claude rejects an image over 5 MB. */
export const CLAUDE_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/**
 * Claude's whole request is capped at 32 MB, and base64 makes a file a third
 * bigger, so a PDF over ~24 MB cannot fit at all. 20 MB leaves room for the
 * rest of the conversation, and keeps the edge isolate's memory (the bytes,
 * their base64, and the serialised request) well clear of its limit.
 */
export const CLAUDE_MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Approximate decoded size of a base64 string. */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(b64.length * 3 / 4) - pad);
}

function isText(m: string): boolean {
  return m.startsWith('text/') || m === 'application/json';
}

/** Whether Claude (Anthropic API or Vertex) can read this file. */
export function claudeAccepts(f: InlineFile): boolean {
  const m = normalizeMime(f.mime_type) ?? '';
  const size = base64Bytes(f.data);
  if (m === 'application/pdf') return size <= CLAUDE_MAX_PDF_BYTES;
  if (CLAUDE_IMAGE.has(m)) return size <= CLAUDE_MAX_IMAGE_BYTES;
  return isText(m);
}

/** Whether Gemini (AI Studio or Vertex) can read this file inline. */
export function geminiAccepts(f: InlineFile): boolean {
  const m = normalizeMime(f.mime_type) ?? '';
  return m === 'application/pdf' || m.startsWith('image/') || m.startsWith('audio/') ||
    m.startsWith('video/') || isText(m);
}

/** base64 → UTF-8 text, for text files (sent as text, not as opaque bytes). */
/**
 * base64 for binary data, chunked because `String.fromCharCode(...bytes)` on a
 * multi-megabyte array overflows the argument limit.
 */
export function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToText(b64: string): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(decodeBase64(b64));
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Claude content blocks for files: a PDF as a `document`, an image as an
 * `image`, text as a plain-text `document`. Throws for a type Claude cannot
 * take — callers check claudeAccepts first, so this is a programming error.
 */
// deno-lint-ignore no-explicit-any
export function claudeFileBlocks(files: InlineFile[]): any[] {
  return files.map((f) => {
    const m = normalizeMime(f.mime_type) ?? '';
    if (m === 'application/pdf') {
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } };
    }
    if (CLAUDE_IMAGE.has(m)) {
      return { type: 'image', source: { type: 'base64', media_type: m, data: f.data } };
    }
    if (isText(m)) {
      return { type: 'document', source: { type: 'text', media_type: 'text/plain', data: base64ToText(f.data) } };
    }
    throw new Error(`Claude cannot read ${m || 'an untyped file'}`);
  });
}

/**
 * Append files to the last user turn of a Messages-API transcript, files first
 * (Claude reads a document better when it comes before the question). A
 * transcript that does not end on a user turn gets a new one.
 */
// deno-lint-ignore no-explicit-any
export function withClaudeFiles(messages: any[], files: InlineFile[] | undefined): any[] {
  if (!files?.length) return messages;
  const blocks = claudeFileBlocks(files);
  const out = [...messages];
  const last = out[out.length - 1];
  if (last && last.role === 'user') {
    const existing = typeof last.content === 'string'
      ? [{ type: 'text', text: last.content }]
      : Array.isArray(last.content) ? last.content : [];
    out[out.length - 1] = { ...last, content: [...blocks, ...existing] };
  } else {
    out.push({ role: 'user', content: blocks });
  }
  return out;
}

/** Gemini parts for files: inline bytes, except text, which goes as text. */
// deno-lint-ignore no-explicit-any
export function geminiFileParts(files: InlineFile[]): any[] {
  return files.map((f) => {
    const m = normalizeMime(f.mime_type) ?? 'application/octet-stream';
    if (isText(m)) return { text: base64ToText(f.data) };
    return { inlineData: { mimeType: m, data: f.data } };
  });
}

// ---- what a file costs ---------------------------------------------------

/**
 * Per PDF page: its extracted text plus the page image. Anthropic documents
 * 1,500–3,000 tokens a page; the top of that range is used so the budget's
 * worst case is never under.
 */
export const PDF_TOKENS_PER_PAGE = 3_000;
/** A high-resolution image on the newest models tops out under this. */
export const IMAGE_TOKENS = 5_000;
/** Claude reads at most this many PDF pages in one request. */
export const PDF_MAX_PAGES = 100;

/**
 * Page count of a PDF from its bytes, or null when the bytes do not say.
 *
 * Counts `/Type /Page` objects and reads the page tree's `/Count`, taking the
 * larger. PDFs that pack their objects into compressed streams hide both, and
 * then the honest answer is "unknown": callers must not guess low.
 */
export function pdfPageCount(bytes: Uint8Array): number | null {
  const text = new TextDecoder('latin1').decode(bytes);
  const pages = (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
  let count = 0;
  for (const m of text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)) {
    count = Math.max(count, Number(m[1] ?? m[2]));
  }
  const n = Math.max(pages, count);
  return n > 0 ? n : null;
}

/**
 * Upper bound on the prompt tokens one content block costs, or null for a
 * block that is not a file. A PDF whose pages cannot be counted is priced as
 * the most Claude will read (PDF_MAX_PAGES).
 */
// deno-lint-ignore no-explicit-any
export function blockTokenEstimate(block: any): number | null {
  if (block?.type === 'image') return IMAGE_TOKENS;
  if (block?.type === 'document') {
    const src = block.source ?? {};
    if (src.type === 'text') return Math.ceil(String(src.data ?? '').length / 3);
    if (src.type === 'base64' && typeof src.data === 'string') {
      const pages = pdfPageCount(decodeBase64(src.data)) ?? PDF_MAX_PAGES;
      return Math.min(pages, PDF_MAX_PAGES) * PDF_TOKENS_PER_PAGE;
    }
    return PDF_MAX_PAGES * PDF_TOKENS_PER_PAGE;
  }
  return null;
}

/**
 * Split a Messages-API transcript into what its text costs and what its files
 * cost, for the budget's worst-case reservation.
 *
 * Measuring a file's base64 as text gets it wrong both ways: a scanned 2 MB
 * PDF reads as ~900K tokens (more than a student's daily share, so Claude
 * would never be chosen for a file), while a 300 KB text-only PDF of 100 pages
 * reads as ~130K when Claude bills up to ~300K (page images included), and the
 * cap would slip. So each file block is priced by what it is, and the rest of
 * the transcript by its length.
 */
// deno-lint-ignore no-explicit-any
export function mediaAwarePromptSize(messages: any[]): { textChars: number; fileTokens: number } {
  let fileTokens = 0;
  // deno-lint-ignore no-explicit-any
  const strip = (block: any): any => {
    const est = blockTokenEstimate(block);
    if (est !== null) {
      fileTokens += est;
      return { type: block.type };
    }
    if (block?.type === 'tool_result' && Array.isArray(block.content)) {
      return { ...block, content: block.content.map(strip) };
    }
    return block;
  };
  const stripped = (messages ?? []).map((m) => Array.isArray(m?.content) ? { ...m, content: m.content.map(strip) } : m);
  return { textChars: JSON.stringify(stripped).length, fileTokens };
}

// deno-lint-ignore no-explicit-any
function isFileBlock(b: any): boolean {
  return b?.type === 'image' || b?.type === 'document' ||
    (b?.type === 'tool_result' && Array.isArray(b.content) && b.content.some(isFileBlock));
}

/** True when any message carries a file block, at the top level or inside a tool_result. */
// deno-lint-ignore no-explicit-any
export function hasFileBlocks(messages: any[]): boolean {
  return (messages ?? []).some((m) => Array.isArray(m?.content) && m.content.some(isFileBlock));
}

/**
 * The transcript with every file's bytes replaced by a short marker: for
 * storing it (ada_agent_runs.transcript) and for models that cannot read files.
 */
// deno-lint-ignore no-explicit-any
export function withoutFileData(messages: any[]): any[] {
  // deno-lint-ignore no-explicit-any
  const strip = (b: any): any => {
    if (b?.type === 'image' || b?.type === 'document') {
      const media = b.source?.media_type ? ` ${b.source.media_type}` : '';
      return { type: 'text', text: `[${b.type}${media} omitted]` };
    }
    if (b?.type === 'tool_result' && Array.isArray(b.content)) return { ...b, content: b.content.map(strip) };
    return b;
  };
  return (messages ?? []).map((m) => Array.isArray(m?.content) ? { ...m, content: m.content.map(strip) } : m);
}
