import { Injectable } from '@nestjs/common';

interface PrismMode {
  key: string;
  label: string;
  description: string;
  url: string | null;
}

const MODES: Array<{ key: string; label: string; description: string; file?: string }> = [
  { key: 'none', label: 'No sound', description: 'Silence' },
  { key: 'rain', label: 'Rain', description: 'Steady rainfall', file: 'rain.m3u8' },
  { key: 'forest', label: 'Forest', description: 'Woodland ambience', file: 'forest.m3u8' },
  { key: 'cafe', label: 'Café', description: 'Warm coffee-shop murmur', file: 'cafe.m3u8' },
  { key: 'whitenoise', label: 'White noise', description: 'Even broadband noise', file: 'whitenoise.m3u8' },
];

/**
 * §2.4/§2.11 — Prism soundscape catalog. App-authored static content (no DB):
 * 4 modes + "No sound". Stream URLs point at the public CDN bucket; null until
 * GCS_PRISM_CDN_BUCKET (or PRISM_CDN_BASE_URL) is configured.
 */
@Injectable()
export class PrismService {
  catalog() {
    const base =
      process.env.PRISM_CDN_BASE_URL ||
      (process.env.GCS_PRISM_CDN_BUCKET ? `https://storage.googleapis.com/${process.env.GCS_PRISM_CDN_BUCKET}` : '');
    const modes: PrismMode[] = MODES.map((m) => ({
      key: m.key,
      label: m.label,
      description: m.description,
      url: m.file && base ? `${base}/prism/${m.file}` : null,
    }));
    return { modes };
  }
}
