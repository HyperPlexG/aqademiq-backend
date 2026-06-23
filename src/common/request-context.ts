import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface Ctx { userId: string; isGuest: boolean; }

/** Holds the authenticated user for the request lifetime so no repository
 *  method takes a user_id param from controllers (every table is user-scoped, §3). */
@Injectable()
export class RequestContext {
  private als = new AsyncLocalStorage<Ctx>();
  run(ctx: Ctx, fn: () => unknown) { return this.als.run(ctx, fn); }
  get userId(): string {
    const s = this.als.getStore();
    if (!s) throw new Error('No auth context — guard misconfigured');
    return s.userId;
  }
  get isGuest(): boolean { return this.als.getStore()?.isGuest ?? false; }
}
