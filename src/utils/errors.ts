export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

export function notImplemented(_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  res.status(501).json(errorBody('NOT_IMPLEMENTED', 'Not implemented in web phase'));
}

export function errorHandler(
  err: unknown,
  _req: unknown,
  res: { status: (n: number) => { json: (b: unknown) => void } },
  _next: unknown
) {
  if (err instanceof AppError) {
    return res.status(err.status).json(errorBody(err.code, err.message));
  }
  if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'MulterError') {
    return res.status(400).json(errorBody('VALIDATION_ERROR', (err as Error).message));
  }
  console.error(err);
  return res.status(500).json(errorBody('INTERNAL_ERROR', 'Internal server error'));
}
