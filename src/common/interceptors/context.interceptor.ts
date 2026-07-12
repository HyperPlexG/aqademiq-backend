import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContext } from '../request-context';

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  constructor(private rc: RequestContext) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    if (!req.userId) return next.handle();
    return this.rc.run({ userId: req.userId, isGuest: req.isGuest }, () => next.handle()) as Observable<unknown>;
  }
}
