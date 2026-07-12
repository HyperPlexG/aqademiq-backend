const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src', 'features');
fs.mkdirSync(SRC, { recursive: true });

// Each module: name, controller base route, spec ref, and its endpoints.
// endpoint = [httpMethod, path, handlerName, "spec note"]
const MODULES = {
  auth: { base: 'auth', ref: '§2.1/§4.1', public: true, endpoints: [
    ['Post','guest','guest','issue real anonymous user + JWT pair'],
    ['Post','signup','signup','collect email/pw; pendingVerification; nothing minted yet'],
    ['Post','verify-otp','verifyOtp','validate 6-digit code → mint tokens'],
    ['Post','resend-otp','resendOtp','24s cooldown'],
    ['Post','signin','signin','argon2id verify; Redis lockout counters'],
    ['Post','refresh','refresh','rotate refresh; reuse-detection revokes family'],
    ['Post','forgot-password','forgotPassword','issue reset code'],
    ['Post','forgot-password/verify','forgotVerify','verify reset code'],
    ['Post','forgot-password/reset','forgotReset','set new pw; revoke ALL sessions'],
    ['Post','change-password','changePassword','verify old; optional revoke others'],
    ['Post','link-guest','linkGuest','in-place promotion of guest user'],
    ['Post','signout','signout','revoke this session; deny-list'],
    ['Get','sessions','listSessions','multi-device list'],
    ['Delete','sessions/:id','revokeSession','remote sign-out'],
    ['Post','sessions/revoke-all','revokeAll','sign out everywhere'],
    ['Post','sso/apple','ssoApple','verify Apple JWKS'],
    ['Post','sso/google','ssoGoogle','verify Google JWKS'],
    ['Delete','account','deleteAccount','GDPR erasure: soft-delete + async cascade purge'],
  ]},
  onboarding: { base: 'onboarding', ref: '§2.1', endpoints: [
    ['Post','complete','complete','atomic+idempotent: profile+subjects+semester+settings; triggers initial Ada plan'],
  ]},
  profile: { base: 'profile', ref: '§2.8', endpoints: [
    ['Get','','get','UserProfile 1:1'],
    ['Patch','','update','name/gender/dob/university/program/avatar_index(0-7)'],
  ]},
  settings: { base: 'me', ref: '§2.8', endpoints: [
    ['Get','settings','getSettings','theme/prism/notif times'],
    ['Patch','settings','patchSettings','cross-device sync'],
    ['Get','email-preferences','getEmailPrefs','toggles'],
    ['Patch','email-preferences','patchEmailPrefs','suppression at send time'],
    ['Get','export','exportData','GDPR data export (§4.9)'],
  ]},
  tasks: { base: 'tasks', ref: '§2.2/§4.2', endpoints: [
    ['Get','','query','?date= (day materialization) or ?from=&to= — THE core engine §4.2'],
    ['Post','','create','quick-add or full form; parse repeat; validate subject_id (422)'],
    ['Patch',':occ','patch','edit occurrence (EDITED override)'],
    ['Patch',':occ/toggle','toggle','flip done on {series}@{date}; siblings unaffected'],
    ['Post','move','move','from→to; preserve HH:MM:SS; cancel/re-enqueue reminders'],
    ['Delete',':occ','remove','tombstone override prevents regeneration'],
    ['Post',':occ/breakdown','breakdown','Haiku 4.5 microsteps; regex fallback'],
    ['Get','history/completions','completions','{isoDate:count} heatmap; cache+invalidate'],
  ]},
  subjects: { base: 'subjects', ref: '§2.3', endpoints: [
    ['Get','','list','?semester_id= filter; next_label/focus_label derived server-side'],
    ['Get',':id','get','single subject'],
    ['Post','','create',''],
    ['Patch',':id','update',''],
    ['Delete',':id','remove','soft-delete only (FK throws on unknown)'],
    ['Post',':id/files','addFile','metadata; maintain files_count; normalize kind'],
    ['Post',':id/files/scan','scanFile','OCR scanned images only (§4.4)'],
  ]},
  semesters: { base: 'semesters', ref: '§2.3', endpoints: [
    ['Get','','list',''],
    ['Get','active','getActive','exactly one active per user'],
    ['Post','','create',''],
    ['Patch',':id','update',''],
    ['Patch',':id/activate','activate',''],
    ['Delete',':id','remove','409 if last; keep subjects (hidden)'],
  ]},
  files: { base: '', ref: '§2.3/§4.4', endpoints: [
    ['Post','uploads/init','initUpload','presigned PUT (init→PUT→commit)'],
    ['Post','uploads/:id/commit','commitUpload','finalize after client PUT; enqueue virus scan'],
    ['Delete','files/:id','remove','soft-delete; decrement files_count'],
    ['Patch','files/:id','patch','star/important toggle'],
    ['Get','files/:id/download','download','owner-only short-TTL signed URL; 404 foreign'],
    ['Get','files/:id/thumbnail','thumbnail',''],
  ]},
  focus: { base: 'focus-sessions', ref: '§2.4', endpoints: [
    ['Post','','start','5–120m; default 25'],
    ['Patch',':id','checkpoint','sync elapsed/status at checkpoints'],
    ['Post',':id/complete','complete','atomically mark linked task done; capture mood'],
  ]},
  prism: { base: 'prism-modes', ref: '§2.4/§2.11', endpoints: [
    ['Get','','catalog','4 modes + No sound; CDN URLs from public bucket'],
  ]},
  ada: { base: 'ada', ref: '§2.5/§4.3', endpoints: [
    ['Post','conversations','createConversation',''],
    ['Get','conversations','listConversations','history (Haiku auto-titled)'],
    ['Get','conversations/:id/messages','listMessages',''],
    ['Post','conversations/:id/messages','postMessage','SSE stream; Opus 4.8 tool use'],
    ['Post','conversations/:cid/messages/:mid/apply-plan','applyPlan','validate-before-apply gate (§4.3)'],
    ['Post','conversations/:id/archive','archive',''],
    ['Post','chat/clear','clear',''],
    ['Post','uploads','upload','S3/GCS-backed; feeds extraction'],
    ['Post','plan-week','planWeek','async job; constraint-based multi-day schedule'],
  ]},
  mood: { base: 'mood-entries', ref: '§2.7', endpoints: [
    ['Post','','log','upsert; re-log overwrites mood, PRESERVES reflection'],
    ['Post',':date/reflection','reflect','upsert reflection, PRESERVES mood (asymmetric merge)'],
    ['Get',':date','getDay',''],
    ['Get','week','week','Mon..Sun 7-slot; nulls for unlogged'],
    ['Get','today','today','?field= flags drive check-in prompts'],
  ]},
  streaks: { base: 'streaks', ref: '§2.6/§4.7', endpoints: [
    ['Get','current','current','server-authoritative; tz day-bucketed; Redis cache + nightly recompute'],
  ]},
  tags: { base: 'study-tags', ref: '§2.8', endpoints: [
    ['Get','','list','seed 7 on account creation'],
    ['Post','','create','case-insensitive dedup'],
    ['Delete',':label','remove',''],
  ]},
  notifications: { base: 'me/notifications', ref: '§2.9', endpoints: [
    ['Get','history','history','from NotificationLog'],
    ['Get','inbox','inbox','notification center (P2)'],
    ['Post','test','test','send a test push'],
  ]},
  devices: { base: 'devices', ref: '§2.9/§4.5', endpoints: [
    ['Post','','register','push_token/platform/timezone(IANA)/permission'],
    ['Patch',':id','update',''],
    ['Delete',':id','remove',''],
    ['Post',':id/heartbeat','heartbeat',''],
  ]},
  referrals: { base: 'referrals', ref: '§2.10', endpoints: [
    ['Post','redeem','redeem','attribution on signup'],
    ['Get','rewards/balance','rewardBalance','append-only ledger (P2)'],
  ]},
  integrations: { base: 'integrations', ref: '§2.12', endpoints: [
    ['Post','calendar/ics','importIcs','ICS subscription import'],
    ['Post','google/oauth/callback','googleOauth','Google Calendar import (Apple=on-device)'],
  ]},
  feedback: { base: '', ref: '§2.12', endpoints: [
    ['Post','ratings','rate','1–5 + comment; route to Slack'],
    ['Post','feedback','feedback','free text; fire-and-forget'],
    ['Post','telemetry/events','telemetry','consent-gated, PII-minimized'],
  ]},
  sync: { base: 'sync', ref: '§4.6', endpoints: [
    ['Get','changes','changes','?since= ordered upserts/tombstones'],
    ['Post','mutations','mutations','batch with base_revision; LWW + done-wins'],
    ['Get','cursor','cursor','current monotonic cursor'],
  ]},
};

function ctrlName(n){return n.charAt(0).toUpperCase()+n.slice(1);}
function decoratorPath(p){return p===''? "'/'": `'${p}'`;}

for (const [name, m] of Object.entries(MODULES)) {
  const dir = path.join(SRC, name);
  fs.mkdirSync(dir, { recursive: true });
  const Cls = ctrlName(name);
  const pub = m.public ? `\nimport { Public } from '../../common/guards/jwt-auth.guard';` : '';

  // controller
  const methods = m.endpoints.map(([http, p, fn, note]) => {
    const dec = m.public ? '  @Public()\n' : '';
    return `${dec}  @${http}(${decoratorPath(p)})\n  ${fn}(/* TODO ${m.ref}: ${note} */) {\n    return this.svc.${fn}();\n  }`;
  }).join('\n\n');

  fs.writeFileSync(path.join(dir, `${name}.controller.ts`),
`import { Controller, Get, Post, Patch, Delete } from '@nestjs/common';${pub}
import { ${Cls}Service } from './${name}.service';

/** ${m.ref} — base route: /v1/${m.base || '(root)'} */
@Controller(${decoratorPath(m.base)})
export class ${Cls}Controller {
  constructor(private readonly svc: ${Cls}Service) {}

${methods}
}
`);

  // service
  const svcMethods = m.endpoints.map(([_h,_p,fn,note]) =>
`  /** TODO ${m.ref}: ${note} */
  ${fn}() { throw new Error('Not implemented: ${name}.${fn} (${m.ref})'); }`).join('\n\n');

  fs.writeFileSync(path.join(dir, `${name}.service.ts`),
`import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';

/** ${m.ref} — business logic. Scaffolded: signatures present, bodies are TODOs. */
@Injectable()
export class ${Cls}Service {
  constructor(private readonly prisma: PrismaService) {}

${svcMethods}
}
`);

  // module
  fs.writeFileSync(path.join(dir, `${name}.module.ts`),
`import { Module } from '@nestjs/common';
import { ${Cls}Controller } from './${name}.controller';
import { ${Cls}Service } from './${name}.service';

@Module({ controllers: [${Cls}Controller], providers: [${Cls}Service], exports: [${Cls}Service] })
export class ${Cls}Module {}
`);
}

console.log('Generated', Object.keys(MODULES).length, 'feature modules with',
  Object.values(MODULES).reduce((a,m)=>a+m.endpoints.length,0), 'endpoints');
