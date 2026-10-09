export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, "Sign in to continue.");
export const forbidden = () =>
  new HttpError(403, "You don't have permission to do this.");
export const notFound = (what: string) =>
  new HttpError(404, `${what} not found.`);
export const badRequest = (message: string) => new HttpError(400, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Drizzle wraps driver errors in 'cause', so check both levels. */
export function pgCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}
