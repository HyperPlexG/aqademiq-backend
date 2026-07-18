import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { EmailService } from '../../infra/email.service';
import { RequestContext } from '../../common/request-context';
import {
  AdminNoteDto,
  AdminPatchPostDto,
  ChangelogEntryDto,
  ChangelogPatchDto,
  CreateCommentDto,
  CreatePostDto,
  QueryPostsDto,
} from './dto/feedback-board.dto';

const PAGE_SIZE = 20;
const MAX_POSTS_PER_DAY = 2; // nolt-style spam cap (§6 rate limiting)
const DAY_MS = 86_400_000;

/**
 * Feedback & roadmap board — native nolt-parity feature (phase 1).
 *
 * This board is a SHARED, public surface (everyone sees everyone's posts), so it
 * is NOT tenant-scoped: services use raw `prisma.*`, never `prisma.tenant.*`, and
 * the models are absent from TENANT_MODELS. Ownership/authorship is tracked via
 * author_id (= auth.users.id) and enforced here in the application layer.
 *
 * Guest rule: browsing (all GETs) is open to any authenticated principal incl.
 * guests; voting / posting / commenting requires a real (non-guest) account.
 * Admin surface is gated by the FEEDBACK_ADMIN_IDS allowlist (roles are P2).
 */
@Injectable()
export class FeedbackBoardService {
  private readonly log = new Logger('FeedbackBoard');

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly rc: RequestContext,
  ) {}

  // ---- Config / meta -----------------------------------------------------

  async meta() {
    const [statuses, categories] = await Promise.all([
      this.prisma.feedbackStatus.findMany({ orderBy: { sort_order: 'asc' } }),
      this.prisma.feedbackCategory.findMany({ orderBy: { label: 'asc' } }),
    ]);
    return {
      statuses: statuses.map((s) => ({ key: s.key, label: s.label, color: s.color, on_roadmap: s.on_roadmap })),
      categories: categories.map((c) => ({ key: c.key, label: c.label })),
    };
  }

  // ---- Board listing -----------------------------------------------------

  /** GET /feedback/posts — list / filter / search / sort with cursor paging. */
  async list(q: QueryPostsDto) {
    const offset = this.parseCursor(q.cursor);
    const where: any = { approved: true, merged_into: null };
    if (q.status) where.status_key = q.status;
    if (q.category) where.category_key = q.category;
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { body: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    const orderBy: any[] =
      q.sort === 'new'
        ? [{ pinned: 'desc' }, { created_at: 'desc' }]
        : [{ pinned: 'desc' }, { upvotes: 'desc' }, { created_at: 'desc' }];

    const posts = await this.prisma.feedbackPost.findMany({
      where,
      orderBy,
      skip: offset,
      take: PAGE_SIZE + 1,
    });

    const hasMore = posts.length > PAGE_SIZE;
    const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;
    const [voted, authors] = await Promise.all([
      this.votedSet(page.map((p) => p.id)),
      this.authorMap(page.map((p) => p.author_id)),
    ]);

    return {
      posts: page.map((p) => this.serializePost(p, voted.has(p.id), authors)),
      next_cursor: hasMore ? String(offset + PAGE_SIZE) : null,
    };
  }

  /** GET /feedback/similar?q= — live duplicate suggestions for the composer. */
  async similar(term: string) {
    const posts = await this.prisma.feedbackPost.findMany({
      where: {
        approved: true,
        merged_into: null,
        title: { contains: term, mode: 'insensitive' },
      },
      orderBy: [{ upvotes: 'desc' }],
      take: 5,
    });
    return {
      similar: posts.map((p) => ({
        ref: p.ref,
        title: p.title,
        upvotes: p.upvotes,
        status: p.status_key,
      })),
    };
  }

  /** GET /feedback/roadmap — posts grouped by on-roadmap status. */
  async roadmap() {
    const statuses = await this.prisma.feedbackStatus.findMany({
      where: { on_roadmap: true },
      orderBy: { sort_order: 'asc' },
    });
    const keys = statuses.map((s) => s.key);
    const posts = await this.prisma.feedbackPost.findMany({
      where: { approved: true, merged_into: null, status_key: { in: keys } },
      orderBy: [{ pinned: 'desc' }, { upvotes: 'desc' }, { created_at: 'desc' }],
    });
    const [voted, authors] = await Promise.all([
      this.votedSet(posts.map((p) => p.id)),
      this.authorMap(posts.map((p) => p.author_id)),
    ]);

    return {
      groups: statuses.map((s) => ({
        status: { key: s.key, label: s.label, color: s.color },
        posts: posts
          .filter((p) => p.status_key === s.key)
          .map((p) => this.serializePost(p, voted.has(p.id), authors)),
      })),
    };
  }

  // ---- Post detail -------------------------------------------------------

  /** GET /feedback/posts/:ref — detail + comments + status history + you_voted. */
  async detail(ref: number) {
    const post = await this.getPostByRef(ref);
    if (!post.approved && !this.isAdmin() && post.author_id !== this.rc.userId) {
      throw new NotFoundException('Post not found');
    }

    const [comments, changes, voted, subscribed] = await Promise.all([
      this.prisma.feedbackComment.findMany({
        where: { post_id: post.id, deleted_at: null },
        orderBy: { created_at: 'asc' },
      }),
      this.prisma.feedbackStatusChange.findMany({
        where: { post_id: post.id },
        orderBy: { created_at: 'asc' },
      }),
      this.hasVoted(post.id),
      this.isSubscribed(post.id),
    ]);

    const authorIds = [
      post.author_id,
      ...comments.map((c) => c.author_id),
      ...changes.map((c) => c.actor_id),
    ];
    const authors = await this.authorMap(authorIds);

    return {
      ...this.serializePost(post, voted, authors),
      you_subscribed: subscribed,
      comments: comments.map((c) => this.serializeComment(c, authors)),
      status_history: changes.map((c) => this.serializeStatusChange(c, authors)),
    };
  }

  // ---- Create post -------------------------------------------------------

  /** POST /feedback/posts — create (auth, non-guest). Returns similar candidates. */
  async createPost(dto: CreatePostDto) {
    this.assertNotGuest('post a suggestion');
    await this.assertPostRateLimit();

    if (dto.category) await this.assertCategory(dto.category);

    const post = await this.prisma.feedbackPost.create({
      data: {
        author_id: this.rc.userId,
        title: dto.title.trim(),
        body: dto.body?.trim() ?? '',
        category_key: dto.category ?? null,
      },
    });

    // Author auto-subscribes to their own thread (§6 notification model).
    await this.subscribeInternal(post.id, this.rc.userId);

    const authors = await this.authorMap([post.author_id]);
    const similar = await this.similar(dto.title);
    return {
      ...this.serializePost(post, false, authors),
      you_subscribed: true,
      similar: similar.similar.filter((s) => s.ref !== post.ref),
    };
  }

  // ---- Voting ------------------------------------------------------------

  /** POST /feedback/posts/:ref/vote — idempotent, server-enforced one-per-user. */
  async vote(ref: number) {
    this.assertNotGuest('vote');
    const post = await this.getPostByRef(ref);
    const userId = this.rc.userId;

    const upvotes = await this.prisma.$transaction(async (tx) => {
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
  }

  /** DELETE /feedback/posts/:ref/vote — remove vote, keep the count in sync. */
  async unvote(ref: number) {
    this.assertNotGuest('vote');
    const post = await this.getPostByRef(ref);
    const userId = this.rc.userId;

    const upvotes = await this.prisma.$transaction(async (tx) => {
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
  }

  // ---- Comments ----------------------------------------------------------

  /** POST /feedback/posts/:ref/comments — add comment (auth; 409 if locked). */
  async addComment(ref: number, dto: CreateCommentDto) {
    this.assertNotGuest('comment');
    const post = await this.getPostByRef(ref);
    if (post.locked) throw new ConflictException('This thread is locked');

    let parentId: bigint | null = null;
    if (dto.parent_id) {
      const parent = await this.prisma.feedbackComment.findFirst({
        where: { id: BigInt(dto.parent_id), post_id: post.id, deleted_at: null },
        select: { id: true, parent_id: true },
      });
      if (!parent) throw new BadRequestException('parent_id does not belong to this post');
      // Single-level threading: a reply to a reply attaches to the top-level parent.
      parentId = parent.parent_id ?? parent.id;
    }

    const isTeam = this.isAdmin();
    const comment = await this.prisma.$transaction(async (tx) => {
      const c = await tx.feedbackComment.create({
        data: {
          post_id: post.id,
          author_id: this.rc.userId,
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
    await this.subscribeInternal(post.id, this.rc.userId);
    await this.notifySubscribers(post, {
      excludeUserId: this.rc.userId,
      subject: `New reply on “${post.title}” (#${post.ref})`,
      text: `${isTeam ? 'The Aqademiq team' : 'Someone'} replied to a suggestion you follow:\n\n${dto.body.trim()}`,
    });

    const authors = await this.authorMap([comment.author_id]);
    return this.serializeComment(comment, authors);
  }

  // ---- Subscriptions -----------------------------------------------------

  async subscribe(ref: number) {
    this.assertNotGuest('subscribe');
    const post = await this.getPostByRef(ref);
    await this.subscribeInternal(post.id, this.rc.userId);
    return { ref, you_subscribed: true };
  }

  async unsubscribe(ref: number) {
    this.assertNotGuest('subscribe');
    const post = await this.getPostByRef(ref);
    await this.prisma.feedbackSubscription.deleteMany({
      where: { post_id: post.id, user_id: this.rc.userId },
    });
    return { ref, you_subscribed: false };
  }

  // ---- Changelog ---------------------------------------------------------

  /** GET /changelog — published entries, newest first. */
  async changelog() {
    const entries = await this.prisma.changelogEntry.findMany({
      where: { published_at: { not: null } },
      orderBy: { published_at: 'desc' },
    });
    return { entries: entries.map((e) => this.serializeChangelog(e)) };
  }

  // ========================================================================
  // Admin surface (FEEDBACK_ADMIN_IDS-gated)
  // ========================================================================

  /** PATCH /admin/feedback/posts/:ref — status / category / pinned / locked / approved. */
  async adminPatchPost(ref: number, dto: AdminPatchPostDto) {
    this.requireAdmin();
    const post = await this.getPostByRef(ref);

    const data: any = { updated_at: new Date() };
    if (dto.category !== undefined) {
      if (dto.category) await this.assertCategory(dto.category);
      data.category_key = dto.category || null;
    }
    if (dto.pinned !== undefined) data.pinned = dto.pinned;
    if (dto.locked !== undefined) data.locked = dto.locked;
    if (dto.approved !== undefined) data.approved = dto.approved;

    let statusChanged = false;
    if (dto.status !== undefined && dto.status !== post.status_key) {
      await this.assertStatus(dto.status);
      data.status_key = dto.status;
      statusChanged = true;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.feedbackPost.update({ where: { id: post.id }, data });
      if (statusChanged) {
        await tx.feedbackStatusChange.create({
          data: {
            post_id: post.id,
            from_status: post.status_key,
            to_status: dto.status!,
            actor_id: this.rc.userId,
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
      const st = await this.prisma.feedbackStatus.findUnique({ where: { key: dto.status! } });
      await this.notifySubscribers(post, {
        excludeUserId: this.rc.userId,
        subject: `“${post.title}” is now ${st?.label ?? dto.status} (#${post.ref})`,
        text: `A suggestion you follow moved to “${st?.label ?? dto.status}”.${dto.note ? `\n\n${dto.note}` : ''}`,
      });
    }

    const authors = await this.authorMap([updated.author_id]);
    return this.serializePost(updated, false, authors);
  }

  /** POST /admin/feedback/posts/:ref/notes — private, never serialized to users. */
  async adminAddNote(ref: number, dto: AdminNoteDto) {
    this.requireAdmin();
    const post = await this.getPostByRef(ref);
    const note = await this.prisma.feedbackAdminNote.create({
      data: { post_id: post.id, author_id: this.rc.userId, body: dto.body.trim() },
    });
    return { id: Number(note.id), post_ref: ref, body: note.body, created_at: note.created_at };
  }

  /** GET /admin/feedback/queue — unapproved posts awaiting moderation. */
  async adminQueue() {
    this.requireAdmin();
    const posts = await this.prisma.feedbackPost.findMany({
      where: { approved: false, merged_into: null },
      orderBy: { created_at: 'asc' },
    });
    const authors = await this.authorMap(posts.map((p) => p.author_id));
    return { posts: posts.map((p) => this.serializePost(p, false, authors)) };
  }

  /** POST /admin/changelog — create a draft or published entry. */
  async adminCreateChangelog(dto: ChangelogEntryDto) {
    this.requireAdmin();
    let sourcePost: bigint | null = null;
    if (dto.source_ref) {
      const src = await this.prisma.feedbackPost.findUnique({ where: { ref: dto.source_ref } });
      if (!src) throw new BadRequestException('source_ref does not match a post');
      sourcePost = src.id;
    }
    const entry = await this.prisma.changelogEntry.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        source_post: sourcePost,
        published_at: dto.publish ? new Date() : null,
      },
    });
    return this.serializeChangelog(entry);
  }

  /** PATCH /admin/changelog/:id — edit and/or publish an entry. */
  async adminPatchChangelog(id: number, dto: ChangelogPatchDto) {
    this.requireAdmin();
    const existing = await this.prisma.changelogEntry.findUnique({ where: { id: BigInt(id) } });
    if (!existing) throw new NotFoundException('Changelog entry not found');

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.body !== undefined) data.body = dto.body.trim();
    if (dto.publish !== undefined) {
      data.published_at = dto.publish ? existing.published_at ?? new Date() : null;
    }
    const entry = await this.prisma.changelogEntry.update({ where: { id: BigInt(id) }, data });
    return this.serializeChangelog(entry);
  }

  // ========================================================================
  // Internals
  // ========================================================================

  private async getPostByRef(ref: number) {
    const post = await this.prisma.feedbackPost.findUnique({ where: { ref } });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private async assertCategory(key: string) {
    const c = await this.prisma.feedbackCategory.findUnique({ where: { key } });
    if (!c) throw new BadRequestException(`Unknown category: ${key}`);
  }

  private async assertStatus(key: string) {
    const s = await this.prisma.feedbackStatus.findUnique({ where: { key } });
    if (!s) throw new BadRequestException(`Unknown status: ${key}`);
  }

  private assertNotGuest(action: string) {
    if (this.rc.isGuest) throw new ForbiddenException(`Create an account to ${action}`);
  }

  private async assertPostRateLimit() {
    const since = new Date(Date.now() - DAY_MS);
    const recent = await this.prisma.feedbackPost.count({
      where: { author_id: this.rc.userId, created_at: { gte: since } },
    });
    if (recent >= MAX_POSTS_PER_DAY) {
      throw new HttpException(
        `Daily suggestion limit reached (${MAX_POSTS_PER_DAY}/day). Try again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private isAdmin(): boolean {
    const ids = (process.env.FEEDBACK_ADMIN_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.includes(this.rc.userId);
  }

  private requireAdmin() {
    if (!this.isAdmin()) throw new ForbiddenException('Admin access required');
  }

  private async subscribeInternal(postId: bigint, userId: string) {
    await this.prisma.feedbackSubscription.createMany({
      data: [{ post_id: postId, user_id: userId }],
      skipDuplicates: true,
    });
  }

  private async hasVoted(postId: bigint): Promise<boolean> {
    const v = await this.prisma.feedbackVote.findUnique({
      where: { post_id_user_id: { post_id: postId, user_id: this.rc.userId } },
    });
    return Boolean(v);
  }

  private async isSubscribed(postId: bigint): Promise<boolean> {
    const s = await this.prisma.feedbackSubscription.findUnique({
      where: { post_id_user_id: { post_id: postId, user_id: this.rc.userId } },
    });
    return Boolean(s);
  }

  /** Set of post ids the current user has voted on, for a batch of posts. */
  private async votedSet(postIds: bigint[]): Promise<Set<bigint>> {
    if (postIds.length === 0) return new Set();
    const votes = await this.prisma.feedbackVote.findMany({
      where: { user_id: this.rc.userId, post_id: { in: postIds } },
      select: { post_id: true },
    });
    return new Set(votes.map((v) => v.post_id));
  }

  /** Batch-resolve author profiles (name + avatar) for a set of user ids. */
  private async authorMap(ids: (string | null)[]): Promise<Map<string, { id: string; name: string | null; avatar_url: string | null }>> {
    const unique = [...new Set(ids.filter((i): i is string => Boolean(i)))];
    const map = new Map<string, { id: string; name: string | null; avatar_url: string | null }>();
    if (unique.length === 0) return map;
    const profiles = await this.prisma.profile.findMany({
      where: { id: { in: unique } },
      select: { id: true, display_name: true, full_name: true, avatar_url: true },
    });
    for (const p of profiles) {
      map.set(p.id, { id: p.id, name: p.display_name ?? p.full_name ?? null, avatar_url: p.avatar_url ?? null });
    }
    return map;
  }

  private author(id: string | null, authors: Map<string, any>) {
    if (!id) return null;
    return authors.get(id) ?? { id, name: null, avatar_url: null };
  }

  /** Best-effort subscriber notification (email when configured, else skipped). */
  private async notifySubscribers(
    post: { id: bigint; ref: number; title: string },
    opts: { excludeUserId: string; subject: string; text: string },
  ) {
    try {
      const subs = await this.prisma.feedbackSubscription.findMany({
        where: { post_id: post.id, user_id: { not: opts.excludeUserId } },
        select: { user_id: true },
      });
      if (subs.length === 0) return;

      if (!this.email.isConfigured()) {
        this.log.log(`notify #${post.ref} → ${subs.length} subscriber(s): ${opts.subject} (email provider not configured)`);
        return;
      }
      const profiles = await this.prisma.profile.findMany({
        where: { id: { in: subs.map((s) => s.user_id) }, email: { not: null } },
        select: { email: true },
      });
      await Promise.all(
        profiles
          .filter((p) => p.email)
          .map((p) => this.email.sendNotification(p.email!, opts.subject, opts.text)),
      );
    } catch (e) {
      this.log.warn(`notifySubscribers failed for #${post.ref}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ---- Serializers (BigInt -> Number for the wire) -----------------------

  private serializePost(p: any, youVoted: boolean, authors: Map<string, any>) {
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
      author: this.author(p.author_id, authors),
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  private serializeComment(c: any, authors: Map<string, any>) {
    return {
      id: Number(c.id),
      parent_id: c.parent_id === null || c.parent_id === undefined ? null : Number(c.parent_id),
      body: c.body,
      is_team: c.is_team,
      author: this.author(c.author_id, authors),
      created_at: c.created_at,
    };
  }

  private serializeStatusChange(c: any, authors: Map<string, any>) {
    return {
      id: Number(c.id),
      from_status: c.from_status,
      to_status: c.to_status,
      note: c.note,
      actor: this.author(c.actor_id, authors),
      created_at: c.created_at,
    };
  }

  private serializeChangelog(e: any) {
    return {
      id: Number(e.id),
      title: e.title,
      body: e.body,
      source_post: e.source_post === null || e.source_post === undefined ? null : Number(e.source_post),
      published_at: e.published_at,
      is_published: Boolean(e.published_at),
    };
  }

  private parseCursor(cursor?: string): number {
    if (!cursor) return 0;
    const n = Number(cursor);
    if (!Number.isInteger(n) || n < 0) throw new BadRequestException('Invalid cursor');
    return n;
  }
}
