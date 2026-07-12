import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Uniform error contract for the Flutter client: every error — HttpException or
 * unexpected — comes back as the same snake_case shape, so the app parses one
 * `Failure` type. Validation errors keep their detail array under `errors`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: unknown = 'Internal server error';
    let errors: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = b.message ?? exception.message;
        errors = b.errors; // class-validator / custom detail arrays
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.log.error(`${req.method} ${req.url} → ${status}`, exception instanceof Error ? exception.stack : undefined);
    }

    res.status(status).json({
      status_code: status,
      error: HttpStatus[status] ?? 'ERROR',
      message,
      ...(errors !== undefined ? { errors } : {}),
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
