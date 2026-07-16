// Wire-contract error shape — port of src/common/filters/http-exception.filter.ts.
// Every error, expected or not, returns the same snake_case body so the
// Flutter client parses a single Failure type:
//   { status_code, error, message, errors?, path, timestamp }

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors?: unknown,
  ) {
    super(message);
  }
}

const STATUS_TEXT: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  501: 'NOT_IMPLEMENTED',
  503: 'SERVICE_UNAVAILABLE',
};

export function errorBody(status: number, message: unknown, path: string, errors?: unknown) {
  return {
    status_code: status,
    error: STATUS_TEXT[status] ?? 'ERROR',
    message,
    ...(errors !== undefined ? { errors } : {}),
    path,
    timestamp: new Date().toISOString(),
  };
}
