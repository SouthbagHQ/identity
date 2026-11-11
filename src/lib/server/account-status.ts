/** Read-only self-status for public clients. Never accepts a caller-selected account. */
export async function accountStatus(
  request: Request,
  auth: { handler(request: Request): Promise<Response> },
  db: { prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null> } } }
): Promise<Response> {
  const answer = (body: unknown, status = 200) => Response.json(body, {
    status, headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'Vary': 'Authorization' }
  });
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(authorization)) {
    return answer({ error: 'bearer_token_required' }, 401);
  }
  try {
    // Reuse the provider's signature/issuer/audience/expiry/scope and user checks.
    // No incoming cookie, query parameter or client-supplied subject is forwarded.
    const url = new URL('/api/auth/oauth2/userinfo', request.url);
    const verified = await auth.handler(new Request(url, { headers: { authorization } }));
    if (!verified.ok) return answer({ error: 'invalid_token' }, 401);
    const claims = await verified.json() as { sub?: unknown };
    if (typeof claims.sub !== 'string' || !claims.sub) return answer({ error: 'invalid_token' }, 401);
    // Fresh DB state on every request. A missing/deleted user never means active.
    const user = await db.prepare('SELECT id, email, frozen FROM user WHERE id = ?')
      .bind(claims.sub).first<{ id: string; email: string; frozen: number }>();
    if (!user || user.id !== claims.sub || typeof user.email !== 'string' ||
        ![0, 1].includes(user.frozen)) return answer({ error: 'account_unavailable' }, 403);
    return answer({ sub: user.id, email: user.email, frozen: user.frozen === 1 });
  } catch {
    // No bearer tokens, cookies, provider response or private freeze reason in logs.
    return answer({ error: 'status_unavailable' }, 503);
  }
}
