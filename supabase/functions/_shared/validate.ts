// Lightweight request-body validation — replaces NestJS class-validator DTOs.
// Throws HttpError(422) with a snake_case message matching the wire contract.
// Keep rules faithful to each src DTO's decorators.

import { HttpError } from './http.ts';

export type Body = Record<string, unknown>;

/** Parse a JSON body; 422 if it isn't a JSON object. Empty body → {}. */
export async function jsonBody(req: { json: () => Promise<unknown> }): Promise<Body> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return {};
  }
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(422, 'Body must be a JSON object');
  return parsed as Body;
}

interface StrOpts { min?: number; max?: number; pattern?: RegExp; enum?: readonly string[]; }

export function str(b: Body, field: string, required: boolean, o: StrOpts = {}): string | undefined {
  const v = b[field];
  if (v === undefined || v === null) {
    if (required) throw new HttpError(422, `${field} is required`);
    return undefined;
  }
  if (typeof v !== 'string') throw new HttpError(422, `${field} must be a string`);
  if (o.min !== undefined && v.length < o.min) throw new HttpError(422, `${field} is too short`);
  if (o.max !== undefined && v.length > o.max) throw new HttpError(422, `${field} is too long`);
  if (o.pattern && !o.pattern.test(v)) throw new HttpError(422, `${field} is invalid`);
  if (o.enum && !o.enum.includes(v)) throw new HttpError(422, `${field} must be one of ${o.enum.join(', ')}`);
  return v;
}

interface NumOpts { min?: number; max?: number; int?: boolean; }

export function num(b: Body, field: string, required: boolean, o: NumOpts = {}): number | undefined {
  const v = b[field];
  if (v === undefined || v === null) {
    if (required) throw new HttpError(422, `${field} is required`);
    return undefined;
  }
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || Number.isNaN(n)) throw new HttpError(422, `${field} must be a number`);
  if (o.int && !Number.isInteger(n)) throw new HttpError(422, `${field} must be an integer`);
  if (o.min !== undefined && n < o.min) throw new HttpError(422, `${field} must be >= ${o.min}`);
  if (o.max !== undefined && n > o.max) throw new HttpError(422, `${field} must be <= ${o.max}`);
  return n;
}

export function bool(b: Body, field: string, required: boolean): boolean | undefined {
  const v = b[field];
  if (v === undefined || v === null) {
    if (required) throw new HttpError(422, `${field} is required`);
    return undefined;
  }
  if (typeof v !== 'boolean') throw new HttpError(422, `${field} must be a boolean`);
  return v;
}
