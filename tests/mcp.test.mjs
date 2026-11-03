// MCP endpoint tests. D1 is in-memory SQLite (schema from drizzle/*.sql); the bank is a mock.
// Freeze behavior is covered via a frozen user row - no internal-API mocks needed here since
// Identity owns the freeze table.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { handleMcp } from '../src/lib/server/mcp.ts';

const migrationsDir = new URL('../drizzle/', import.meta.url).pathname;
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

const USER = 'u-1';
function d1Shim(db) {
	const make = (sql) => ({
		bind: (...args) => ({
			run: async () => { db.prepare(sql).run(...args); return { meta: { changes: 1 } }; },
			first: async () => db.prepare(sql).get(...args) ?? null,
			all: async () => ({ results: db.prepare(sql).all(...args) })
		})
	});
	return { prepare: make };
}

let sqlite, db, charges, frozen, tokens, env;
beforeEach(() => {
	sqlite = new DatabaseSync(':memory:');
	for (const f of files) {
		const sql = readFileSync(join(migrationsDir, f), 'utf8');
		for (const stmt of sql.split('--> statement-breakpoint')) if (stmt.trim()) sqlite.exec(stmt);
	}
	db = d1Shim(sqlite);
	frozen = 0;
	charges = [];
	tokens = [];
	env = {
		DB: db,
		BANKING: {
			async charge(input) { charges.push(input); return { balance: 9900, opened: false, duplicate: charges.filter(c => c.idempotencyKey === input.idempotencyKey).length > 1 }; }
		}
	};
});

function seedUser() {
	sqlite.prepare('INSERT INTO user (id, email, name, frozen) VALUES (?, ?, ?, ?)').run(USER, 'ada@example.com', 'Ada', frozen);
}
function seedToken(token, name = 'ci') {
	const hash = createHash('sha256').update(token).digest('hex');
	sqlite.prepare('INSERT INTO agent_token (id, user_id, name, token_hash, token_prefix, created_at) VALUES (?, ?, ?, ?, ?, 1)').run(randomUUID(), USER, name, hash, token.slice(0, 12));
}
function req(body, { token = null, key = null, version = '2025-06-18' } = {}) {
	return new Request('https://identity.southbag.cc/mcp', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...(token ? { authorization: `Bearer ${token}` } : {}),
			...(key ? { 'idempotency-key': key } : {}),
			...(version ? { 'mcp-protocol-version': version } : {})
		},
		body: JSON.stringify(body)
	});
}
const callTool = (name, args = {}) => req({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, { token: 'sbag_at_testtoken1', key: 'key-00001' });

test('initialize is free and quotes the fee', async () => {
	const res = await handleMcp(req({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }), env);
	assert.equal(res.status, 200);
	const body = await res.json();
	assert.match(body.result.instructions, /\$1\.00 request fee/);
	assert.equal(charges.length, 0);
});
test('tools/list is free and requires a token', async () => {
	seedUser();
	const bad = await handleMcp(req({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }), env);
	assert.equal(bad.status, 401);
	seedToken('sbag_at_testtoken1');
	const ok = await handleMcp(req({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, { token: 'sbag_at_testtoken1' }), env);
	assert.equal(ok.status, 200);
	const names = (await ok.json()).result.tools.map((t) => t.name);
	assert.deepEqual(names.sort(), ['get_account_status', 'list_agent_tokens']);
	assert.equal(charges.length, 0);
});
test('tools/call charges the $1 request fee with a derived bank idempotency key', async () => {
	seedUser(); seedToken('sbag_at_testtoken1');
	const res = await handleMcp(callTool('get_account_status'), env);
	assert.equal(res.status, 200);
	const body = await res.json();
	assert.equal(charges.length, 1);
	assert.equal(charges[0].amount, 100);
	assert.equal(charges[0].idempotencyKey, `mcp|identity|request|${USER}|key-00001`);
	assert.equal(body.result.structuredContent.account.email, 'ada@example.com');
	assert.equal(body.result.structuredContent.receipt.requestFee.amount, 100);
});
test('retried Idempotency-Key replays without a second charge', async () => {
	seedUser(); seedToken('sbag_at_testtoken1');
	const first = await handleMcp(callTool('list_agent_tokens'), env);
	const second = await handleMcp(callTool('list_agent_tokens'), env);
	assert.equal(charges.length, 1);
	const replayed = await second.json();
	assert.equal(replayed.result.structuredContent.receipt.duplicate, true);
	assert.deepEqual(replayed.result.structuredContent.tokens.length, 1);
	assert.equal((await first.json()).id, replayed.id);
});
test('same key with a different tool or arguments is rejected', async () => {
	seedUser(); seedToken('sbag_at_testtoken1');
	await handleMcp(callTool('get_account_status'), env);
	const otherTool = await handleMcp(callTool('list_agent_tokens'), env);
	assert.equal((await otherTool.json()).error.code, -32602);
});
test('missing Idempotency-Key is rejected before charging', async () => {
	seedUser(); seedToken('sbag_at_testtoken1');
	const res = await handleMcp(req({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_account_status', arguments: {} } }, { token: 'sbag_at_testtoken1' }), env);
	assert.equal((await res.json()).error.code, -32602);
	assert.equal(charges.length, 0);
});
test('frozen account is not charged and gets the unfreeze pointer', async () => {
	frozen = 1;
	seedUser(); seedToken('sbag_at_testtoken1');
	const res = await handleMcp(callTool('get_account_status'), env);
	const body = await res.json();
	assert.equal(body.result.isError, true);
	assert.match(body.result.content[0].text, /frozen/);
	assert.equal(charges.length, 0);
});
test('a pending journal row is never re-run', async () => {
	seedUser(); seedToken('sbag_at_testtoken1');
	sqlite.prepare("INSERT INTO mcp_call (idempotency_key, user_id, tool, args_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', 1, 1)")
		.run(`${USER}|key-00001`, USER, 'get_account_status', createHash('sha256').update(JSON.stringify({arguments:{},name:'get_account_status'})).digest('hex'));
	const res = await handleMcp(callTool('get_account_status'), env);
	const body = await res.json();
	assert.equal(body.result.isError, true);
	assert.equal(body.result.structuredContent.unknownOutcome, true);
	assert.equal(charges.length, 0);
});
