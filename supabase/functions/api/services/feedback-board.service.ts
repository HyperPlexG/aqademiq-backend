// Feedback & roadmap board — native nolt-parity feature (phase 1).
// Port of src/features/feedback-board/feedback-board.service.ts.
//
// This board is a SHARED, public surface (everyone sees everyone's posts), so it
// is NOT tenant-scoped: this service uses raw prismaBase(), never tenantDb(), and
// the models are absent from the tenancy set. Ownership/authorship is tracked via
// author_id (= auth.users.id) and enforced here in the application layer.
//
// Guest rule: browsing (all GETs) is open to any authenticated principal incl.
// guests; voting / posting / commenting requires a real (non-guest) account.
// Admin surface is gated by the FEEDBACK_ADMIN_IDS allowlist.
import { prismaBase } from '../../_shared/prisma.ts';
import { email, emailConfigured } from '../../_shared/email.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { env } from '../../_shared/env.ts';

export interface QueryPostsDto {
  sort?: 'top' | 'new';
  status?: string;
  category?: string;
  q?: string;
  cursor?: string;
}

export interface CreatePostDto {
  title: string;
  body?: string;
  category?: string;
}

export interface CreateCommentDto {
  body: string;
  parent_id?: number;
}

export interface AdminPatchPostDto {
  status?: string;
  category?: string;
  pinned?: boolean;
  locked?: boolean;
  approved?: boolean;
  note?: string;
}

export interface AdminNoteDto {
  body: string;
}

export interface ChangelogEntryDto {
  title: string;
  body: string;
  source_ref?: number;
  publish?: boolean;
}

export interface ChangelogPatchDto {
  title?: string;
  body?: string;
  publish?: boolean;
}

const PAGE_SIZE = 20;
const MAX_POSTS_PER_DAY = 2; // nolt-style spam cap (§6 rate limiting)
const DAY_MS = 86_400_000;

// deno-lint-ignore no-explicit-any
type AnyObj = any;
type AuthorInfo = { id: string; name: string | null; avatar_url: string | null };

// ---- Internals ----------------------------------------------------------

async function getPostByRef(ref: number) {
  const post = await prismaBase().feedbackPost.findUnique({ where: { ref } });
  if (!post) throw new HttpError(404, 'Post not found');
  return post;
}

async function assertCategory(key: string) {
  if (!(await knownCategory(key))) throw new HttpError(400, `Unknown category: ${key}`);
}

async function assertStatus(key: string) {
  if (!(await knownStatus(key))) throw new HttpError(400, `Unknown status: ${key}`);
}

/** Does this status exist? Used where an unknown key is reported, not rejected. */
async function knownStatus(key: string): Promise<boolean> {
  return Boolean(await prismaBase().feedbackStatus.findUnique({ where: { key } }));
}

/** Does this category exist? Same reasoning as [knownStatus]. */
async function knownCategory(key: string): Promise<boolean> {
  return Boolean(await prismaBase().feedbackCategory.findUnique({ where: { key } }));
}

function assertNotGuest(action: string) {
  if (RequestContext.isGuest) throw new HttpError(403, `Create an account to ${action}`);
}

async function assertPostRateLimit() {
  const since = new Date(Date.now() - DAY_MS);
  const recent = await prismaBase().feedbackPost.count({
    where: { author_id: RequestContext.userId, created_at: { gte: since } },
  });
  if (recent >= MAX_POSTS_PER_DAY) {
    throw new HttpError(429, `Daily suggestion limit reached (${MAX_POSTS_PER_DAY}/day). Try again tomorrow.`);
  }
}

function isAdmin(): boolean {
  const ids = (env('FEEDBACK_ADMIN_IDS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(RequestContext.userId);
}

function requireAdmin() {
  if (!isAdmin()) throw new HttpError(403, 'Admin access required');
}

async function subscribeInternal(postId: bigint, userId: string) {
  await prismaBase().feedbackSubscription.createMany({
    data: [{ post_id: postId, user_id: userId }],
    skipDuplicates: true,
  });
}

async function hasVoted(postId: bigint): Promise<boolean> {
  const v = await prismaBase().feedbackVote.findUnique({
    where: { post_id_user_id: { post_id: postId, user_id: RequestContext.userId } },
  });
  return Boolean(v);
}

async function isSubscribed(postId: bigint): Promise<boolean> {
  const s = await prismaBase().feedbackSubscription.findUnique({
    where: { post_id_user_id: { post_id: postId, user_id: RequestContext.userId } },
  });
  return Boolean(s);
}

/** Set of post ids the current user has voted on, for a batch of posts. */
async function votedSet(postIds: bigint[]): Promise<Set<bigint>> {
  if (postIds.length === 0) return new Set();
  const votes = await prismaBase().feedbackVote.findMany({
    where: { user_id: RequestContext.userId, post_id: { in: postIds } },
    select: { post_id: true },
  });
  return new Set(votes.map((v: { post_id: bigint }) => v.post_id));
}

/** Batch-resolve author profiles (name + avatar) for a set of user ids. */
async function authorMap(ids: (string | null)[]): Promise<Map<string, AuthorInfo>> {
  const unique = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  const map = new Map<string, AuthorInfo>();
  if (unique.length === 0) return map;
  const profiles = await prismaBase().profile.findMany({
    where: { id: { in: unique } },
    select: { id: true, display_name: true, full_name: true, avatar_url: true },
  });
  for (const p of profiles) {
    map.set(p.id, { id: p.id, name: p.display_name ?? p.full_name ?? null, avatar_url: p.avatar_url ?? null });
  }
  return map;
}

function author(id: string | null, authors: Map<string, AuthorInfo>): AuthorInfo | null {
  if (!id) return null;
  return authors.get(id) ?? { id, name: null, avatar_url: null };
}

/** Best-effort subscriber notification (email when configured, else skipped). */
async function notifySubscribers(
  post: { id: bigint; ref: number; title: string },
  opts: { excludeUserId: string; subject: string; text: string },
) {
  try {
    const subs = await prismaBase().feedbackSubscription.findMany({
      where: { post_id: post.id, user_id: { not: opts.excludeUserId } },
      select: { user_id: true },
    });
    if (subs.length === 0) return;

    if (!emailConfigured()) {
      console.log(`notify #${post.ref} → ${subs.length} subscriber(s): ${opts.subject} (email provider not configured)`);
      return;
    }
    const profiles = await prismaBase().profile.findMany({
      where: { id: { in: subs.map((s: { user_id: string }) => s.user_id) }, email: { not: null } },
      select: { email: true },
    });
    await Promise.all(
      profiles
        .filter((p: { email: string | null }) => p.email)
        .map((p: { email: string | null }) => email.sendNotification(p.email!, opts.subject, opts.text)),
    );
  } catch (e) {
    console.warn(`notifySubscribers failed for #${post.ref}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ---- Serializers (BigInt -> Number for the wire) ------------------------

function serializePost(p: AnyObj, youVoted: boolean, authors: Map<string, AuthorInfo>) {
  return {
    ref: p.ref,
    title: p.title,
    body: p.body,
    status: p.status_key,
    category: p.category_key,
    upvotes: p.upvotes,
    comment_count: p.comment_count,
    pinned: p.pinned,
    locked: p.locked,
    approved: p.approved,
    you_voted: youVoted,
    author: author(p.author_id, authors),
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

function serializeComment(c: AnyObj, authors: Map<string, AuthorInfo>) {
  return {
    id: Number(c.id),
    parent_id: c.parent_id === null || c.parent_id === undefined ? null : Number(c.parent_id),
    body: c.body,
    is_team: c.is_team,
    author: author(c.author_id, authors),
    created_at: c.created_at,
  };
}

function serializeStatusChange(c: AnyObj, authors: Map<string, AuthorInfo>) {
  return {
    id: Number(c.id),
    from_status: c.from_status,
    to_status: c.to_status,
    note: c.note,
    actor: author(c.actor_id, authors),
    created_at: c.created_at,
  };
}

function serializeChangelog(e: AnyObj) {
  return {
    id: Number(e.id),
    title: e.title,
    body: e.body,
    source_post: e.source_post === null || e.source_post === undefined ? null : Number(e.source_post),
    published_at: e.published_at,
    is_published: Boolean(e.published_at),
  };
}

function parseCursor(cursor?: string): number {
  if (!cursor) return 0;
  const n = Number(cursor);
  if (!Number.isInteger(n) || n < 0) throw new HttpError(400, 'Invalid cursor');
  return n;
}

export const feedbackBoardService = {
  // ---- Config / meta ----------------------------------------------------
  async meta() {
    const [statuses, categories] = await Promise.all([
      prismaBase().feedbackStatus.findMany({ orderBy: { sort_order: 'asc' } }),
      prismaBase().feedbackCategory.findMany({ orderBy: { label: 'asc' } }),
    ]);
    return {
      statuses: statuses.map((s: AnyObj) => ({ key: s.key, label: s.label, color: s.color, on_roadmap: s.on_roadmap })),
      categories: categories.map((c: AnyObj) => ({ key: c.key, label: c.label })),
    };
  },

  // ---- Board listing ----------------------------------------------------

  /** GET /feedback/posts — list / filter / search / sort with cursor paging. */
  async list(q: QueryPostsDto) {
    const offset = parseCursor(q.cursor);
    const where: AnyObj = { approved: true, merged_into: null };
    // An unknown filter key still matches nothing — but now it says so.
    //
    // A key this board has never defined produced a well-formed query and zero
    // rows, which is indistinguishable from a board that genuinely has nothing
    // in that state. That is exactly how a stale enum in the app went unnoticed:
    // it filtered on `open`, a status retired long ago, and the empty result
    // read as "nothing was ever marked shipped" while five shipped posts sat in
    // the table.
    //
    // Deliberately a warning and NOT a 400. Every build already in users' hands
    // sends those retired keys, so rejecting them would turn today's harmless
    // empty list into an error screen for everyone who has not updated yet.
    // Once the fixed build is widely adopted this can become `assertStatus`.
    if (q.status) {
      if (!(await knownStatus(q.status))) {
        console.warn(`[feedback] list filtered by unknown status "${q.status}" — returning empty; likely an outdated client`);
      }
      where.status_key = q.status;
    }
    if (q.category) {
      if (!(await knownCategory(q.category))) {
        console.warn(`[feedback] list filtered by unknown category "${q.category}" — returning empty; likely an outdated client`);
      }
      where.category_key = q.category;
    }
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { body: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    const orderBy: AnyObj[] =
      q.sort === 'new'
        ? [{ pinned: 'desc' }, { created_at: 'desc' }]
        : [{ pinned: 'desc' }, { upvotes: 'desc' }, { created_at: 'desc' }];

    const posts = await prismaBase().feedbackPost.findMany({
      where,
      orderBy,
      skip: offset,
      take: PAGE_SIZE + 1,
    });

    const hasMore = posts.length > PAGE_SIZE;
    const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;
    const [voted, authors] = await Promise.all([
      votedSet(page.map((p: AnyObj) => p.id)),
      authorMap(page.map((p: AnyObj) => p.author_id)),
    ]);

    return {
      posts: page.map((p: AnyObj) => serializePost(p, voted.has(p.id), authors)),
      next_cursor: hasMore ? String(offset + PAGE_SIZE) : null,
    };
  },

  /** GET /feedback/similar?q= — live duplicate suggestions for the composer. */
  async similar(term: string) {
    const posts = await prismaBase().feedbackPost.findMany({
      where: {
        approved: true,
        merged_into: null,
        title: { contains: term, mode: 'insensitive' },
      },
      orderBy: [{ upvotes: 'desc' }],
      take: 5,
    });
    return {
      similar: posts.map((p: AnyObj) => ({
        ref: p.ref,
        title: p.title,
        upvotes: p.upvotes,
        status: p.status_key,
      })),
    };
  },

  /** GET /feedback/roadmap — posts grouped by on-roadmap status. */
  async roadmap() {
    const statuses = await prismaBase().feedbackStatus.findMany({
      where: { on_roadmap: true },
      orderBy: { sort_order: 'asc' },
    });
    const keys = statuses.map((s: AnyObj) => s.key);
    const posts = await prismaBase().feedbackPost.findMany({
      where: { approved: true, merged_into: null, status_key: { in: keys } },
      orderBy: [{ pinned: 'desc' }, { upvotes: 'desc' }, { created_at: 'desc' }],
    });
    const [voted, authors] = await Promise.all([
      votedSet(posts.map((p: AnyObj) => p.id)),
      authorMap(posts.map((p: AnyObj) => p.author_id)),
    ]);

    return {
      groups: statuses.map((s: AnyObj) => ({
        status: { key: s.key, label: s.label, color: s.color },
        posts: posts
          .filter((p: AnyObj) => p.status_key === s.key)
          .map((p: AnyObj) => serializePost(p, voted.has(p.id), authors)),
      })),
    };
  },

  // ---- Post detail ------------------------------------------------------

  /** GET /feedback/posts/:ref — detail + comments + status history + you_voted. */
  async detail(ref: number) {
    const post = await getPostByRef(ref);
    if (!post.approved && !isAdmin() && post.author_id !== RequestContext.userId) {
      throw new HttpError(404, 'Post not found');
    }

    const [comments, changes, voted, subscribed] = await Promise.all([
      prismaBase().feedbackComment.findMany({
        where: { post_id: post.id, deleted_at: null },
        orderBy: { created_at: 'asc' },
      }),
      prismaBase().feedbackStatusChange.findMany({
        where: { post_id: post.id },
        orderBy: { created_at: 'asc' },
      }),
      hasVoted(post.id),
      isSubscribed(post.id),
    ]);

    const authorIds = [
      post.author_id,
      ...comments.map((c: AnyObj) => c.author_id),
      ...changes.map((c: AnyObj) => c.actor_id),
    ];
    const authors = await authorMap(authorIds);

    return {
      ...serializePost(post, voted, authors),
      you_subscribed: subscribed,
      comments: comments.map((c: AnyObj) => serializeComment(c, authors)),
      status_history: changes.map((c: AnyObj) => serializeStatusChange(c, authors)),
    };
  },

  // ---- Create post ------------------------------------------------------

  /** POST /feedback/posts — create (auth, non-guest). Returns similar candidates. */
  async createPost(dto: CreatePostDto) {
    assertNotGuest('post a suggestion');
    await assertPostRateLimit();

    if (dto.category) await assertCategory(dto.category);

    const post = await prismaBase().feedbackPost.create({
      data: {
        author_id: RequestContext.userId,
        title: dto.title.trim(),
        body: dto.body?.trim() ?? '',
        category_key: dto.category ?? null,
      },
    });

    // Author auto-subscribes to their own thread (§6 notification model).
    await subscribeInternal(post.id, RequestContext.userId);

    const authors = await authorMap([post.author_id]);
    const similar = await this.similar(dto.title);
    return {
      ...serializePost(post, false, authors),
      you_subscribed: true,
      similar: similar.similar.filter((s: AnyObj) => s.ref !== post.ref),
    };
  },

  // ---- Voting -----------------------------------------------------------

  /** POST /feedback/posts/:ref/vote — idempotent, server-enforced one-per-user. */
  async vote(ref: number) {
    assertNotGuest('vote');
    const post = await getPostByRef(ref);
    const userId = RequestContext.userId;

    const upvotes = await prismaBase().$transaction(async (tx: AnyObj) => {
      const inserted = await tx.feedbackVote.createMany({
        data: [{ post_id: post.id, user_id: userId }],
        skipDuplicates: true,
      });
      if (inserted.count > 0) {
        const updated = await tx.feedbackPost.update({
          where: { id: post.id },
          data: { upvotes: { increment: 1 } },
          select: { upvotes: true },
        });
        return updated.upvotes;
      }
      return post.upvotes;
    });

    return { ref, upvotes, you_voted: true };
  },

  /** DELETE /feedback/posts/:ref/vote — remove vote, keep the count in sync. */
  async unvote(ref: number) {
    assertNotGuest('vote');
    const post = await getPostByRef(ref);
    const userId = RequestContext.userId;

    const upvotes = await prismaBase().$transaction(async (tx: AnyObj) => {
      const removed = await tx.feedbackVote.deleteMany({
        where: { post_id: post.id, user_id: userId },
      });
      if (removed.count > 0) {
        const updated = await tx.feedbackPost.update({
          where: { id: post.id },
          data: { upvotes: { decrement: 1 } },
          select: { upvotes: true },
        });
        return updated.upvotes;
      }
      return post.upvotes;
    });

    return { ref, upvotes, you_voted: false };
  },

  // ---- Comments ---------------------------------------------------------

  /** POST /feedback/posts/:ref/comments — add comment (auth; 409 if locked). */
  async addComment(ref: number, dto: CreateCommentDto) {
    assertNotGuest('comment');
    const post = await getPostByRef(ref);
    if (post.locked) throw new HttpError(409, 'This thread is locked');

    let parentId: bigint | null = null;
    if (dto.parent_id) {
      const parent = await prismaBase().feedbackComment.findFirst({
        where: { id: BigInt(dto.parent_id), post_id: post.id, deleted_at: null },
        select: { id: true, parent_id: true },
      });
      if (!parent) throw new HttpError(400, 'parent_id does not belong to this post');
      // Single-level threading: a reply to a reply attaches to the top-level parent.
      parentId = parent.parent_id ?? parent.id;
    }

    const isTeam = isAdmin();
    const comment = await prismaBase().$transaction(async (tx: AnyObj) => {
      const c = await tx.feedbackComment.create({
        data: {
          post_id: post.id,
          author_id: RequestContext.userId,
          parent_id: parentId,
          body: dto.body.trim(),
          is_team: isTeam,
        },
      });
      await tx.feedbackPost.update({
        where: { id: post.id },
        data: { comment_count: { increment: 1 }, updated_at: new Date() },
      });
      return c;
    });

    // Commenter auto-subscribes; notify the other subscribers of the reply.
    await subscribeInternal(post.id, RequestContext.userId);
    await notifySubscribers(post, {
      excludeUserId: RequestContext.userId,
      subject: `New reply on “${post.title}” (#${post.ref})`,
      text: `${isTeam ? 'The Aqademiq team' : 'Someone'} replied to a suggestion you follow:\n\n${dto.body.trim()}`,
    });

    const authors = await authorMap([comment.author_id]);
    return serializeComment(comment, authors);
  },

  // ---- Subscriptions ----------------------------------------------------

  async subscribe(ref: number) {
    assertNotGuest('subscribe');
    const post = await getPostByRef(ref);
    await subscribeInternal(post.id, RequestContext.userId);
    return { ref, you_subscribed: true };
  },

  async unsubscribe(ref: number) {
    assertNotGuest('subscribe');
    const post = await getPostByRef(ref);
    await prismaBase().feedbackSubscription.deleteMany({
      where: { post_id: post.id, user_id: RequestContext.userId },
    });
    return { ref, you_subscribed: false };
  },

  // ---- Changelog --------------------------------------------------------

  /** GET /changelog — published entries, newest first. */
  async changelog() {
    const entries = await prismaBase().changelogEntry.findMany({
      where: { published_at: { not: null } },
      orderBy: { published_at: 'desc' },
    });
    return { entries: entries.map((e: AnyObj) => serializeChangelog(e)) };
  },

  // ======================================================================
  // Admin surface (FEEDBACK_ADMIN_IDS-gated)
  // ======================================================================

  /** PATCH /admin/feedback/posts/:ref — status / category / pinned / locked / approved. */
  async adminPatchPost(ref: number, dto: AdminPatchPostDto) {
    requireAdmin();
    const post = await getPostByRef(ref);

    const data: AnyObj = { updated_at: new Date() };
    if (dto.category !== undefined) {
      if (dto.category) await assertCategory(dto.category);
      data.category_key = dto.category || null;
    }
    if (dto.pinned !== undefined) data.pinned = dto.pinned;
    if (dto.locked !== undefined) data.locked = dto.locked;
    if (dto.approved !== undefined) data.approved = dto.approved;

    let statusChanged = false;
    if (dto.status !== undefined && dto.status !== post.status_key) {
      await assertStatus(dto.status);
      data.status_key = dto.status;
      statusChanged = true;
    }

    const updated = await prismaBase().$transaction(async (tx: AnyObj) => {
      const u = await tx.feedbackPost.update({ where: { id: post.id }, data });
      if (statusChanged) {
        await tx.feedbackStatusChange.create({
          data: {
            post_id: post.id,
            from_status: post.status_key,
            to_status: dto.status!,
            actor_id: RequestContext.userId,
            note: dto.note ?? null,
          },
        });
        // Shipped requests auto-draft a changelog entry the admin can publish (§7).
        if (dto.status === 'shipped') {
          const already = await tx.changelogEntry.findFirst({ where: { source_post: post.id } });
          if (!already) {
            await tx.changelogEntry.create({
              data: {
                title: post.title,
                body: dto.note?.trim() || post.body || '',
                source_post: post.id,
                published_at: null, // draft
              },
            });
          }
        }
      }
      return u;
    });

    if (statusChanged) {
      const st = await prismaBase().feedbackStatus.findUnique({ where: { key: dto.status! } });
      await notifySubscribers(post, {
        excludeUserId: RequestContext.userId,
        subject: `“${post.title}” is now ${st?.label ?? dto.status} (#${post.ref})`,
        text: `A suggestion you follow moved to “${st?.label ?? dto.status}”.${dto.note ? `\n\n${dto.note}` : ''}`,
      });
    }

    const authors = await authorMap([updated.author_id]);
    return serializePost(updated, false, authors);
  },

  /** POST /admin/feedback/posts/:ref/notes — private, never serialized to users. */
  async adminAddNote(ref: number, dto: AdminNoteDto) {
    requireAdmin();
    const post = await getPostByRef(ref);
    const note = await prismaBase().feedbackAdminNote.create({
      data: { post_id: post.id, author_id: RequestContext.userId, body: dto.body.trim() },
    });
    return { id: Number(note.id), post_ref: ref, body: note.body, created_at: note.created_at };
  },

  /** GET /admin/feedback/queue — unapproved posts awaiting moderation. */
  async adminQueue() {
    requireAdmin();
    const posts = await prismaBase().feedbackPost.findMany({
      where: { approved: false, merged_into: null },
      orderBy: { created_at: 'asc' },
    });
    const authors = await authorMap(posts.map((p: AnyObj) => p.author_id));
    return { posts: posts.map((p: AnyObj) => serializePost(p, false, authors)) };
  },

  /** POST /admin/changelog — create a draft or published entry. */
  async adminCreateChangelog(dto: ChangelogEntryDto) {
    requireAdmin();
    let sourcePost: bigint | null = null;
    if (dto.source_ref) {
      const src = await prismaBase().feedbackPost.findUnique({ where: { ref: dto.source_ref } });
      if (!src) throw new HttpError(400, 'source_ref does not match a post');
      sourcePost = src.id;
    }
    const entry = await prismaBase().changelogEntry.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        source_post: sourcePost,
        published_at: dto.publish ? new Date() : null,
      },
    });
    return serializeChangelog(entry);
  },

  /** PATCH /admin/changelog/:id — edit and/or publish an entry. */
  async adminPatchChangelog(id: number, dto: ChangelogPatchDto) {
    requireAdmin();
    const existing = await prismaBase().changelogEntry.findUnique({ where: { id: BigInt(id) } });
    if (!existing) throw new HttpError(404, 'Changelog entry not found');

    const data: AnyObj = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.body !== undefined) data.body = dto.body.trim();
    if (dto.publish !== undefined) {
      data.published_at = dto.publish ? existing.published_at ?? new Date() : null;
    }
    const entry = await prismaBase().changelogEntry.update({ where: { id: BigInt(id) }, data });
    return serializeChangelog(entry);
  },
};
