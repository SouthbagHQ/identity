// Exercises the account-level freeze (src/lib/server/freeze.ts) against a real SQL engine
// (node:sqlite) with the real drizzle migrations, through the same D1-API shim Banking's tests
// use. Banking itself is a mock: it records charges and status syncs, and can be told to fail.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerQuestion, attemptUnfreeze, getFreezeStatus, paymentDue, pickQuestion, QUESTIONS,
  REVIEW_FEE_CENTS, setFrozen, syncPending, WRONG_ANSWER_FEE_CENTS,
} from '../src/lib/server/freeze.ts';

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

function mockBank() {
  return {
    charges: [],
    statuses: [],
    failCharge: false,
    failStatus: false,
    async charge(input) {
      if (this.failCharge) throw new Error('bank unreachable');
      this.charges.push(input);
      return { balance: 100000 - input.amount, opened: false };
    },
    async setStatus(input) {
      if (this.failStatus) throw new Error('bank unreachable');
      this.statuses.push(input);
      return { ok: true };
    },
  };
}

const SIGNUP = Date.UTC(2026, 0, 5); // a Monday in AEST (UTC+10): Jan 5 2026 00:00 UTC = 10:00 AEST Monday

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync('drizzle').sort()) {
    if (!file.endsWith('.sql')) continue;
    for (const stmt of readFileSync('drizzle/' + file, 'utf8').split('--> statement-breakpoint')) {
      const sql = stmt.trim();
      if (sql) sqlite.exec(sql);
    }
  }
  sqlite.prepare(`INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('u1', 'Test User', 'u1@example.com', 1, ?, ?)`).run(SIGNUP, SIGNUP);
  const db = d1Shim(sqlite);
  const bank = mockBank();
  return { sqlite, db, env: { BANKING: bank }, bank };
}

const userRow = sqlite => sqlite.prepare(`SELECT * FROM user WHERE id = 'u1'`).get();
const charges = sqlite => sqlite.prepare(`SELECT * FROM freeze_charge WHERE user_id = 'u1'`).all();

/** Answers whatever question is currently set, correctly. */
async function answerCorrectly(db, env, sqlite) {
  const row = userRow(sqlite);
  const q = QUESTIONS[row.security_question];
  assert.ok(q, `unknown question ${row.security_question}`);
  // Every question except signup_day accepts a lore answer; find one by trying candidates.
  const candidates = ['monday', 'kevin', 'ip 355', '250', 'nobody', 'on', '2019', 'lake burley griffin', 'there is no floor 3', 'he was already there'];
  for (const candidate of candidates) {
    const user = { id: 'u1', name: 'Test User', email: 'u1@example.com', created_at: SIGNUP, frozen: 1, frozen_reason: 'x', frozen_at: 1, security_question: row.security_question, security_streak: row.security_streak };
    if (await q.check(db, user, candidate)) return answerQuestion(db, env, 'u1', candidate);
  }
  assert.fail(`no known answer for ${row.security_question}`);
}

test('freeze is idempotent and records history', async () => {
  const { sqlite, db, env, bank } = setup();
  assert.deepEqual(await setFrozen(db, env, { userId: 'u1', reason: 'Force push', origin: 'git-fraud', actor: 'southbag-git' }), { ok: true });
  assert.equal(userRow(sqlite).frozen, 1);
  assert.ok(userRow(sqlite).security_question, 'first question assigned');
  const again = await setFrozen(db, env, { userId: 'u1', reason: 'Other reason', origin: 'backfill', actor: 'backfill' });
  assert.deepEqual(again, { ok: true, alreadyFrozen: true });
  assert.equal(userRow(sqlite).frozen_reason, 'Force push', 'original reason stands');
  const events = sqlite.prepare(`SELECT * FROM freeze_event WHERE user_id = 'u1'`).all();
  assert.equal(events.length, 1);
  assert.deepEqual(bank.statuses, [{ userId: 'u1', status: 'frozen', token: '' }], 'banking mirror synced');
  const status = await getFreezeStatus(db, 'u1');
  assert.equal(status.frozen, true);
  assert.equal(status.unfrozenViaFlow, false);
  assert.equal((await setFrozen(db, env, { userId: 'nobody', reason: 'x', origin: 'x', actor: 'x' })).ok, false);
});

test('wrong answers cost the fee once each and reset the streak; repeats are free', async () => {
  const { sqlite, db, env, bank } = setup();
  await setFrozen(db, env, { userId: 'u1', reason: 'test', origin: 'test', actor: 'test' });
  const wrong = 'definitely not the answer';
  const first = await answerQuestion(db, env, 'u1', wrong);
  assert.equal(first.correct, false);
  assert.equal(userRow(sqlite).security_streak, 0);
  assert.deepEqual(bank.charges.map(c => c.amount), [WRONG_ANSWER_FEE_CENTS]);
  const repeat = await answerQuestion(db, env, 'u1', wrong);
  assert.equal(repeat.correct, false);
  assert.deepEqual(bank.charges.map(c => c.amount), [WRONG_ANSWER_FEE_CENTS], 'same wrong answer not charged twice');
  assert.equal(charges(sqlite).filter(c => c.status === 'charged').length, 1);
});

test('three correct answers unfreeze with one review fee; a retry charges nothing', async () => {
  const { sqlite, db, env, bank } = setup();
  await setFrozen(db, env, { userId: 'u1', reason: 'test', origin: 'test', actor: 'test' });
  await answerCorrectly(db, env, sqlite);
  await answerCorrectly(db, env, sqlite);
  assert.equal(userRow(sqlite).frozen, 1);
  const third = await answerCorrectly(db, env, sqlite);
  assert.equal(third.unfrozen, true);
  assert.equal(userRow(sqlite).frozen, 0);
  assert.deepEqual(bank.charges.map(c => c.amount), [REVIEW_FEE_CENTS]);
  assert.deepEqual(bank.statuses.map(s => s.status), ['frozen', 'active']);
  assert.equal((await getFreezeStatus(db, 'u1')).unfrozenViaFlow, true);
  // A retry of the unfreeze (e.g. a crash after charging) charges nothing again.
  const retry = await attemptUnfreeze(db, env, 'u1');
  assert.equal(retry.unfrozen, true);
  assert.equal(bank.charges.length, 1, 'no double review fee');
});

test('a failed review fee keeps the account frozen; the answered streak survives for retry', async () => {
  const { sqlite, db, env, bank } = setup();
  await setFrozen(db, env, { userId: 'u1', reason: 'test', origin: 'test', actor: 'test' });
  await answerCorrectly(db, env, sqlite);
  await answerCorrectly(db, env, sqlite);
  bank.failCharge = true;
  const third = await answerCorrectly(db, env, sqlite);
  assert.equal(third.correct, true);
  assert.equal(third.unfrozen, false);
  assert.equal(third.paymentFailed, true);
  assert.equal(userRow(sqlite).frozen, 1, 'no silent unfreeze when billing fails');
  assert.equal(await paymentDue(db, 'u1'), true, 'streak persists for a payment retry');
  bank.failCharge = false;
  const retry = await attemptUnfreeze(db, env, 'u1');
  assert.equal(retry.unfrozen, true);
  assert.deepEqual(bank.charges.map(c => c.amount), [REVIEW_FEE_CENTS], 'charged once, on the retry');
  assert.equal(userRow(sqlite).frozen, 0);
});

test('banking status sync failures are retried from the event history', async () => {
  const { sqlite, db, env, bank } = setup();
  bank.failStatus = true;
  await setFrozen(db, env, { userId: 'u1', reason: 'test', origin: 'test', actor: 'test' });
  assert.equal(bank.statuses.length, 0, 'sync failed');
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM freeze_event WHERE synced = 0`).get().n, 1);
  bank.failStatus = false;
  await syncPending(db, env, 'u1');
  assert.deepEqual(bank.statuses, [{ userId: 'u1', status: 'frozen', token: '' }], 'sync retried');
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM freeze_event WHERE synced = 0`).get().n, 0);
});

test('wrong-answer fee dedupes the SAME answer only; a different wrong answer is charged again', async () => {
  const { db, env, bank } = setup();
  await setFrozen(db, env, { userId: 'u1', reason: 'test', origin: 'test', actor: 'test' });
  await answerQuestion(db, env, 'u1', 'wrong one');
  await answerQuestion(db, env, 'u1', 'wrong one');
  assert.deepEqual(bank.charges.map(c => c.amount), [WRONG_ANSWER_FEE_CENTS], 'same answer charged once');
  await answerQuestion(db, env, 'u1', 'wrong two');
  assert.deepEqual(bank.charges.map(c => c.amount), [WRONG_ANSWER_FEE_CENTS, WRONG_ANSWER_FEE_CENTS], 'a new wrong guess costs its own fee');
});

test('event ordering: rapid freeze/unfreeze/freeze syncs latest only, nothing resurrects', async () => {
  const { sqlite, db, env, bank } = setup();
  bank.failStatus = true; // every sync lost; ordering must survive in the event history
  await setFrozen(db, env, { userId: 'u1', reason: 'one', origin: 'test', actor: 'test' });
  await attemptUnfreeze(db, env, 'u1'); // charges and records the unfreeze event
  await setFrozen(db, env, { userId: 'u1', reason: 'two', origin: 'test', actor: 'test' });
  assert.equal(bank.statuses.length, 0, 'all syncs failed so far');
  bank.failStatus = false;
  await syncPending(db, env, 'u1');
  // Only the LATEST state reaches the bank, and every event is marked synced.
  assert.deepEqual(bank.statuses, [{ userId: 'u1', status: 'frozen', token: '' }], 'latest wins');
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM freeze_event WHERE synced = 0`).get().n, 0);
  // A later sync has nothing pending: a stale 'active' cannot clear the newer freeze.
  await syncPending(db, env, 'u1');
  assert.deepEqual(bank.statuses.map(x => x.status), ['frozen'], 'no resurrection');
  assert.equal(userRow(sqlite).frozen, 1);
});

test('concurrent freeze reports for the same user are idempotent', async () => {
  const { sqlite, db, env } = setup();
  const [a, b] = await Promise.all([
    setFrozen(db, env, { userId: 'u1', reason: 'race', origin: 'test', actor: 'test' }),
    setFrozen(db, env, { userId: 'u1', reason: 'race', origin: 'test', actor: 'test' })
  ]);
  assert.equal(a.ok && b.ok, true);
  assert.equal(userRow(sqlite).frozen, 1);
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM freeze_event WHERE user_id = 'u1' AND action = 'frozen'`).get().n >= 1, true);
});

test('signup_day question checks the account creation weekday in AEST', async () => {
  const { db } = setup();
  const user = { id: 'u1', name: 'T', email: null, created_at: SIGNUP, frozen: 1, frozen_reason: null, frozen_at: null, security_question: 'signup_day', security_streak: 0 };
  assert.equal(await QUESTIONS.signup_day.check(db, user, 'Monday'), true);
  assert.equal(await QUESTIONS.signup_day.check(db, user, 'monday morning'), true);
  assert.equal(await QUESTIONS.signup_day.check(db, user, 'Tuesday'), false);
});

test('pickQuestion never repeats the previous question', () => {
  for (const id of Object.keys(QUESTIONS)) assert.notEqual(pickQuestion(id), id);
});
