// Request-scoped identity — port of src/common/request-context.ts.
// Same AsyncLocalStorage pattern (Deno supports node:async_hooks), so feature
// code and the Prisma tenancy wrapper read userId without parameter threading.

import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestIdentity {
  userId: string;
  isGuest: boolean;
  sessionId: string;
}

const als = new AsyncLocalStorage<RequestIdentity>();

export const RequestContext = {
  run<T>(identity: RequestIdentity, fn: () => T): T {
    return als.run(identity, fn);
  },

  get current(): RequestIdentity | undefined {
    return als.getStore();
  },

  get userId(): string {
    const store = als.getStore();
    if (!store) throw new Error('RequestContext accessed outside a request scope');
    return store.userId;
  },

  get isGuest(): boolean {
    return als.getStore()?.isGuest ?? false;
  },
};
