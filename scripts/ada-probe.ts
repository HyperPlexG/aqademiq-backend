// Drive Ada end-to-end against the real backend, with no real user involved.
//
// Ada cannot be exercised in isolation — it reads subjects, tasks, files and
// memories through tenanted services, so a user with real state is the only way
// to see what a student sees. This signs in as an ANONYMOUS user, which is the
// same guest path the app itself uses, seeds a little state, sends a prompt, and
// prints where the time went.
//
// It times the two things users complain about separately:
//   • the message round trip   (“Ada is taking super long”)
//   • approve-all              (“I pressed approve all and it didn’t go through”)
//
//   deno run --allow-net --allow-env scripts/ada-probe.ts "plan my week"
//   deno run --allow-net --allow-env scripts/ada-probe.ts --approve "plan my week"
//   deno run --allow-net --allow-env scripts/ada-probe.ts --seed --approve "..."
//   deno run --allow-net --allow-env scripts/ada-probe.ts --reuse <token> "..."
//
// Env (or pass --url/--key): SUPABASE_URL, SUPABASE_ANON_KEY.
// Both are public values — the anon key ships inside the app binary.
//
// NOTE: this talks to PRODUCTION and spends real provider quota. Each run
// without --reuse creates one anonymous account; they are labelled in
// user_metadata as {probe: true} so they can be found and deleted later:
//   select id from auth.users where raw_user_meta_data->>'probe' = 'true';

const args = [...Deno.args];
function flag(name: string): boolean {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
}
function opt(name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args.splice(i, 2)[1];
}

const doSeed = flag('--seed');
const doApprove = flag('--approve');
const reuseToken = opt('--reuse');
const SUPABASE_URL = opt('--url') ?? Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = opt('--key') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const prompt = args.join(' ').trim() || 'Plan my week';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Need SUPABASE_URL and SUPABASE_ANON_KEY (env or --url/--key).');
  Deno.exit(1);
}
const API = `${SUPABASE_URL}/functions/v1/api/v1`;

/** Wall-clock around one call, because latency is the thing being measured. */
async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round(performance.now() - t0);
    // 30_000 is Dio's receiveTimeout: past it the app has already given up,
    // whatever the server goes on to do.
    const verdict = ms > 30_000 ? '  ← PAST THE APP’S 30s TIMEOUT' : '';
    console.log(`  ${label}: ${(ms / 1000).toFixed(1)}s${verdict}`);
  }
}

let token = reuseToken ?? '';

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
      'content-type': 'application/json',
      // Mutations carry one in the app; the backend deduplicates on it.
      'idempotency-key': crypto.randomUUID(),
      ...(init.headers ?? {}),
    },
  });
}

async function json(res: Response, what: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${what} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

// ---- 1. identity ----------------------------------------------------------
if (!token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ data: { probe: true, created_by: 'ada-probe' } }),
  });
  const body = await json(res, 'anonymous sign-in');
  token = String((body as { access_token?: string }).access_token ?? '');
  if (!token) throw new Error(`no access_token in sign-in response: ${JSON.stringify(body).slice(0, 300)}`);
  console.log(`probe user: ${(body as { user?: { id?: string } }).user?.id}`);
  console.log(`(reuse it with --reuse ${token.slice(0, 12)}…)\n`);
}

// ---- 2. optional state ----------------------------------------------------
// An empty account is the one case that never reproduces a real complaint:
// no subjects means no context block, no tasks means nothing to read.
if (doSeed) {
  console.log('seeding…');
  const subject = await json(
    await api('/subjects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Optimization', color_hex: '#7F77DD' }),
    }),
    'create subject',
  );
  const subjectId = (subject as { id?: string }).id;
  for (const [i, title] of ['Problem set 3', 'Read chapter 5', 'Revise simplex'].entries()) {
    const due = new Date(Date.now() + (i + 1) * 86_400_000).toISOString().slice(0, 10);
    await json(
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title, subject_id: subjectId, due_date: due }),
      }),
      'create task',
    );
  }
  console.log('  subject + 3 tasks created\n');
}

// ---- 3. the message -------------------------------------------------------
const convo = await json(await api('/ada/conversations', { method: 'POST', body: '{}' }), 'create conversation');
const convoId = String((convo as { id?: string }).id);
console.log(`conversation ${convoId}`);
console.log(`prompt: ${JSON.stringify(prompt)}\n`);

const reply = await timed('message round trip', async () =>
  json(
    await api(`/ada/conversations/${convoId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text: prompt }),
    }),
    'post message',
  ));

// ---- 4. what the agent actually did ---------------------------------------
const run = (reply as { run?: Record<string, unknown> }).run ?? reply;
const get = (k: string) => (run as Record<string, unknown>)[k];
console.log('\nrun');
console.log(`  status        ${get('status') ?? '(none)'}`);
console.log(`  turns         ${get('turns') ?? '?'}   llm_calls ${get('llm_calls') ?? '?'}`);
console.log(`  stopped       ${get('stopped_reason') ?? '—'}`);
console.log(`  tokens        ${get('prompt_tokens') ?? '?'} in / ${get('completion_tokens') ?? '?'} out`);

const scratch = get('scratchpad');
if (Array.isArray(scratch)) {
  // The scratchpad is the one place that says WHICH tool calls spent the budget.
  console.log('\nwhat it spent its calls on');
  for (const line of scratch) console.log(`  · ${line}`);
}

const actions = (await json(await api('/ada/pending-actions'), 'list pending')) as {
  actions?: Array<{ id: string; title?: string; status?: string }>;
};
const pending = actions.actions ?? [];
console.log(`\npending actions: ${pending.length}`);
for (const a of pending.slice(0, 10)) console.log(`  · ${a.title ?? a.id} [${a.status}]`);

// ---- 5. approve-all -------------------------------------------------------
// decideAll executes every action sequentially inside ONE request and resumes
// the agent afterwards, so this is where the 30s client timeout bites.
if (doApprove && pending.length > 0) {
  console.log(`\napproving all ${pending.length}…`);
  try {
    const res = await timed('approve-all round trip', async () =>
      json(
        await api(`/ada/conversations/${convoId}/actions/decide`, {
          method: 'POST',
          body: JSON.stringify({ approve: true }),
        }),
        'decide all',
      ));
    const results = Array.isArray(res) ? res : (res as { results?: unknown[] }).results ?? [];
    console.log(`  server reported ${results.length} decisions`);
  } catch (e) {
    console.log(`  FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }

  const after = (await json(await api('/ada/pending-actions'), 'list pending')) as {
    actions?: Array<{ status?: string }>;
  };
  const left = (after.actions ?? []).length;
  console.log(`  still pending afterwards: ${left}${left > 0 ? '  ← approve-all did not land' : ''}`);
}
