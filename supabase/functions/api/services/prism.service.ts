// §2.4/§2.11 — Prism soundscape catalog + per-user preferences.
// Port of src/features/prism/prism.service.ts.
//
// The catalog itself is app-authored static content (4 modes + "No sound");
// stream URLs point at the public CDN bucket. Each non-silent mode is backed by
// a system `prism_presets` row (seeded lazily) so a session / preference can
// reference a stable `preset_id`. Per-user defaults (chosen mode, volume,
// adaptive, play-in-focus) persist on `prism_audio_profiles` (user-scoped).
import { prismaBase } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { env } from '../../_shared/env.ts';

export interface UpdatePrismPreferencesDto {
  default_mode?: string;
  volume_level?: number;
  adaptive_audio?: boolean;
  play_in_focus?: boolean;
}

interface PrismMode {
  key: string;
  label: string;
  description: string;
  url: string | null;
  preset_id: string | null;
}

const MODES: Array<{ key: string; label: string; description: string; file?: string }> = [
  { key: 'none', label: 'No sound', description: 'Silence' },
  { key: 'rain', label: 'Rain', description: 'Steady rainfall', file: 'rain.m3u8' },
  { key: 'forest', label: 'Forest', description: 'Woodland ambience', file: 'forest.m3u8' },
  { key: 'cafe', label: 'Café', description: 'Warm coffee-shop murmur', file: 'cafe.m3u8' },
  { key: 'whitenoise', label: 'White noise', description: 'Even broadband noise', file: 'whitenoise.m3u8' },
];

/**
 * The Prism *engine* modes the app actually runs.
 *
 * These are synthesised on device by flutter_soloud, not streamed from a CDN, so
 * they have no file and never appear in the mode catalog. They still need a
 * prism_presets row, because the app sends these labels verbatim as
 * `prism_mode` when a focus session starts and analytics joins on the preset.
 *
 * Without them the vocabularies did not overlap at all — the server knew
 * rain/forest/cafe/whitenoise, the app sent "Deep Work" — so resolvePresetId
 * returned null for every real session. Measured on production: 2 of 84 rows
 * carried a preset id.
 */
const ENGINE_MODES: Array<{ key: string; label: string; description: string }> = [
  { key: 'Deep Work', label: 'Deep Work', description: 'Bright, dense low-frequency pulses' },
  { key: 'Flow', label: 'Flow', description: 'Focus stems with a calmer surface' },
  { key: 'Review', label: 'Review', description: 'Steady midtempo with rain texture' },
  { key: 'Wind-down', label: 'Wind-down', description: 'Choir pad and sea, no rhythm' },
];

const PROFILE_DEFAULTS = { volume_level: 50, adaptive_audio: true, play_in_focus: true };

// Cache: system-preset key→id (shared across requests; presets are app-global).
let presetIdByKey: Map<string, string> | null = null;

function preferencesDto(p: {
  default_preset_id: string | null;
  volume_level: number;
  adaptive_audio: boolean;
  play_in_focus: boolean;
}) {
  // Map the preset id back to a mode key for client convenience.
  let mode = 'none';
  if (p.default_preset_id && presetIdByKey) {
    for (const [key, id] of presetIdByKey) {
      if (id === p.default_preset_id) { mode = key; break; }
    }
  }
  return {
    default_mode: mode,
    default_preset_id: p.default_preset_id,
    volume_level: p.volume_level,
    adaptive_audio: p.adaptive_audio,
    play_in_focus: p.play_in_focus,
  };
}

/** Idempotently seed the system presets and cache key→id. */
async function ensureSeeded(): Promise<Map<string, string>> {
  if (presetIdByKey) return presetIdByKey;
  const map = new Map<string, string>();
  // Streamed modes (those with a file) plus the on-device engine modes. 'none'
  // is deliberately absent: audio off means a NULL preset, not a preset row.
  for (const m of [...MODES.filter((x) => x.file), ...ENGINE_MODES]) {
    const preset = await prismaBase().prismPreset.upsert({
      where: { name: m.label },
      create: { name: m.label, description: m.description, is_system: true },
      update: {},
    });
    map.set(m.key, preset.id);
  }
  presetIdByKey = map;
  return map;
}

export const prismService = {
  async catalog() {
    const ids = await ensureSeeded();
    const base =
      env('PRISM_CDN_BASE_URL') ||
      (env('GCS_PRISM_CDN_BUCKET') ? `https://storage.googleapis.com/${env('GCS_PRISM_CDN_BUCKET')}` : '');
    const modes: PrismMode[] = MODES.map((m) => ({
      key: m.key,
      label: m.label,
      description: m.description,
      url: m.file && base ? `${base}/prism/${m.file}` : null,
      preset_id: ids.get(m.key) ?? null,
    }));
    return { modes };
  },

  /** GET /prism-modes/preferences — the caller's saved Prism defaults. */
  async getPreferences() {
    const profile = await prismaBase().prismAudioProfile.findUnique({
      where: { user_id: RequestContext.userId },
    });
    return preferencesDto(
      profile ?? { default_preset_id: null, ...PROFILE_DEFAULTS },
    );
  },

  /** PUT /prism-modes/preferences — upsert the caller's Prism defaults. */
  async setPreferences(dto: UpdatePrismPreferencesDto) {
    const ids = await ensureSeeded();

    // Resolve the chosen mode key (if supplied) to a preset id ('none' → null).
    let defaultPresetId: string | null | undefined;
    if (dto.default_mode !== undefined) {
      defaultPresetId = dto.default_mode === 'none' ? null : ids.get(dto.default_mode) ?? null;
    }

    const data: Record<string, unknown> = {};
    if (defaultPresetId !== undefined) data.default_preset_id = defaultPresetId;
    if (dto.volume_level !== undefined) data.volume_level = dto.volume_level;
    if (dto.adaptive_audio !== undefined) data.adaptive_audio = dto.adaptive_audio;
    if (dto.play_in_focus !== undefined) data.play_in_focus = dto.play_in_focus;

    const profile = await prismaBase().prismAudioProfile.upsert({
      where: { user_id: RequestContext.userId },
      create: {
        user_id: RequestContext.userId,
        default_preset_id: defaultPresetId ?? null,
        volume_level: dto.volume_level ?? PROFILE_DEFAULTS.volume_level,
        adaptive_audio: dto.adaptive_audio ?? PROFILE_DEFAULTS.adaptive_audio,
        play_in_focus: dto.play_in_focus ?? PROFILE_DEFAULTS.play_in_focus,
      },
      update: { ...data, updated_at: new Date() },
    });
    return preferencesDto(profile);
  },

  /** Resolve a client-supplied prism reference (mode key or preset id) to a
   *  preset id for persistence on a focus session. Returns null for silence. */
  async resolvePresetId(modeOrId?: string | null): Promise<string | null> {
    const raw = modeOrId?.trim();
    // Audio off is a NULL preset, which is what "Prism was not on" looks like in
    // the analytics. 'No sound' is the app's label for the same thing.
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (lower === 'none' || lower === 'no sound') return null;

    const ids = await ensureSeeded();
    if (ids.has(raw)) return ids.get(raw)!;                 // a mode key
    if ([...ids.values()].includes(raw)) return raw;        // already a preset id

    // Case- and whitespace-tolerant. The app sends its engine label verbatim, and
    // an exact-match-only lookup is what silently dropped the tag on every
    // session whose casing differed by even one character.
    for (const [key, id] of ids) if (key.toLowerCase() === lower) return id;

    // Last resort: a preset row added by name outside MODES/ENGINE_MODES.
    const byName = await prismaBase().prismPreset.findFirst({
      where: { name: { equals: raw, mode: 'insensitive' } },
      select: { id: true },
    });
    return byName?.id ?? null;
  },
};
