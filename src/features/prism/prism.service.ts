import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { UpdatePrismPreferencesDto } from './dto/prism.dto';

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

const PROFILE_DEFAULTS = { volume_level: 50, adaptive_audio: true, play_in_focus: true };

/**
 * §2.4/§2.11 — Prism soundscape catalog + per-user preferences.
 *
 * The catalog itself is app-authored static content (4 modes + "No sound");
 * stream URLs point at the public CDN bucket. Each non-silent mode is backed by
 * a system `prism_presets` row (seeded lazily) so a session / preference can
 * reference a stable `preset_id`. Per-user defaults (chosen mode, volume,
 * adaptive, play-in-focus) persist on `prism_audio_profiles` (user-scoped).
 */
@Injectable()
export class PrismService {
  private presetIdByKey: Map<string, string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  async catalog() {
    const ids = await this.ensureSeeded();
    const base =
      process.env.PRISM_CDN_BASE_URL ||
      (process.env.GCS_PRISM_CDN_BUCKET ? `https://storage.googleapis.com/${process.env.GCS_PRISM_CDN_BUCKET}` : '');
    const modes: PrismMode[] = MODES.map((m) => ({
      key: m.key,
      label: m.label,
      description: m.description,
      url: m.file && base ? `${base}/prism/${m.file}` : null,
      preset_id: ids.get(m.key) ?? null,
    }));
    return { modes };
  }

  /** GET /prism-modes/preferences — the caller's saved Prism defaults. */
  async getPreferences() {
    const profile = await this.prisma.prismAudioProfile.findUnique({
      where: { user_id: this.rc.userId },
    });
    return this.preferencesDto(
      profile ?? { default_preset_id: null, ...PROFILE_DEFAULTS },
    );
  }

  /** PUT /prism-modes/preferences — upsert the caller's Prism defaults. */
  async setPreferences(dto: UpdatePrismPreferencesDto) {
    const ids = await this.ensureSeeded();

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

    const profile = await this.prisma.prismAudioProfile.upsert({
      where: { user_id: this.rc.userId },
      create: {
        user_id: this.rc.userId,
        default_preset_id: defaultPresetId ?? null,
        volume_level: dto.volume_level ?? PROFILE_DEFAULTS.volume_level,
        adaptive_audio: dto.adaptive_audio ?? PROFILE_DEFAULTS.adaptive_audio,
        play_in_focus: dto.play_in_focus ?? PROFILE_DEFAULTS.play_in_focus,
      },
      update: { ...data, updated_at: new Date() },
    });
    return this.preferencesDto(profile);
  }

  /** Resolve a client-supplied prism reference (mode key or preset id) to a
   *  preset id for persistence on a focus session. Returns null for silence. */
  async resolvePresetId(modeOrId?: string | null): Promise<string | null> {
    if (!modeOrId || modeOrId === 'none') return null;
    const ids = await this.ensureSeeded();
    if (ids.has(modeOrId)) return ids.get(modeOrId)!;      // a mode key
    if ([...ids.values()].includes(modeOrId)) return modeOrId; // already a preset id
    return null;
  }

  // ---- internals ---------------------------------------------------------

  private preferencesDto(p: {
    default_preset_id: string | null;
    volume_level: number;
    adaptive_audio: boolean;
    play_in_focus: boolean;
  }) {
    // Map the preset id back to a mode key for client convenience.
    let mode = 'none';
    if (p.default_preset_id && this.presetIdByKey) {
      for (const [key, id] of this.presetIdByKey) {
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
  private async ensureSeeded(): Promise<Map<string, string>> {
    if (this.presetIdByKey) return this.presetIdByKey;
    const map = new Map<string, string>();
    for (const m of MODES) {
      if (!m.file) continue; // 'none' has no preset row
      const preset = await this.prisma.prismPreset.upsert({
        where: { name: m.label },
        create: { name: m.label, description: m.description, is_system: true },
        update: {},
      });
      map.set(m.key, preset.id);
    }
    this.presetIdByKey = map;
    return map;
  }
}
