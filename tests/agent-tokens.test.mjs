// Exercises agent access tokens (src/lib/server/agent-tokens.ts) against a real SQL engine
// (node:sqlite) with the real drizzle migrations, through the same D1-API shim the freeze tests use.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_TOKEN_PREFIX, createAgentToken, hashAgentToken, listAgentTokens, resolveAgentToken, revokeAgentToken,
} from '../src/lib/server/agent-tokens.ts';

function d1Shim(db) {
  const prepare = sql => ({
    bind(...params) { this.params = params; return this; },
    async first() { return db.prepare(sql).get(...(this.params || [])) ?? null; },
    async all() { return { results: db.prepare(sql).all(...(this.params || [])) }; },
    async run() {
      const r = db.prepare(sql).run(...(this.params || []));
      return { meta: { changes: Number(r.changes) } };
    },
  });
  return { prepare };
}

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync('drizzle').sort()) {
    if (!file.endsWith('.sql')) continue;
    for (const stmt of readFileSync('drizzle/' + file, 'utf8').split('--> statement-breakpoint')) {
      const sql = stmt.trim();
      if (sql) sqlite.exec(sql);
    }
  }
  const now = Date.now();
  sqlite.prepare(`INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('u1', 'Test User', 'u1@example.com', 1, ?, ?)`).run(now, now);
  sqlite.prepare(`INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('u2', 'Other User', 'u2@example.com', 1, ?, ?)`).run(now, now);
  return { sqlite, db: d1Shim(sqlite) };
}

test('a created token resolves to its owner; only the hash is stored', async () => {
  const { sqlite, db } = setup();
  const created = await createAgentToken(db, 'u1', 'My assistant');
  assert.ok(created.token.startsWith(AGENT_TOKEN_PREFIX));
  assert.ok(created.token.length > 30, 'enough entropy to be unguessable');
  const row = sqlite.prepare('SELECT * FROM agent_token WHERE id = ?').get(created.id);
  assert.equal(row.token_hash, await hashAgentToken(created.token));
  assert.ok(!row.token_hash.includes(created.token), 'plaintext never stored');
  assert.equal(row.token_prefix, created.prefix);
  assert.ok(created.token.startsWith(row.token_prefix) === false || row.token_prefix.length < created.token.length);

  const resolved = await resolveAgentToken(db, created.token);
  assert.equal(resolved.user_id, 'u1');
  assert.equal(resolved.name, 'My assistant');
  assert.ok(resolved.last_used_at, 'use recorded');
});

test('unknown, malformed and other-users tokens do not resolve', async () => {
  const { db } = setup();
  await createAgentToken(db, 'u1', 'Mine');
  assert.equal(await resolveAgentToken(db, 'sbag_at_wrong'), null);
  assert.equal(await resolveAgentToken(db, 'not-a-token'), null);
  assert.equal(await resolveAgentToken(db, ''), null);
  assert.equal(await resolveAgentToken(db, null), null);
});

test('revocation is owner-scoped and stops resolution immediately', async () => {
  const { db } = setup();
  const mine = await createAgentToken(db, 'u1', 'Mine');
  // Someone else cannot revoke it.
  assert.equal(await revokeAgentToken(db, 'u2', mine.id), false);
  assert.ok(await resolveAgentToken(db, mine.token), 'still valid');
  assert.equal(await revokeAgentToken(db, 'u1', mine.id), true);
  assert.equal(await resolveAgentToken(db, mine.token), null, 'revoked tokens never resolve');
  // Revoking twice is harmless.
  assert.equal(await revokeAgentToken(db, 'u1', mine.id), false);
});

test('listing shows prefixes and revocation, never hashes', async () => {
  const { db } = setup();
  const a = await createAgentToken(db, 'u1', 'Alpha');
  const b = await createAgentToken(db, 'u1', '');
  assert.equal(b.name, 'Unnamed agent', 'blank names get a default');
  await revokeAgentToken(db, 'u1', a.id);
  const list = await listAgentTokens(db, 'u1');
  assert.equal(list.length, 2);
  for (const row of list) {
    assert.ok(row.token_prefix.startsWith(AGENT_TOKEN_PREFIX));
    assert.equal(Object.hasOwn(row, 'token_hash'), false);
  }
  const alpha = list.find(row => row.id === a.id);
  assert.ok(alpha.revoked_at, 'revocation visible');
  // Other users see nothing of mine.
  assert.deepEqual(await listAgentTokens(db, 'u2'), []);
});
