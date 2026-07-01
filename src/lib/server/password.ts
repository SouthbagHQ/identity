import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_PARAMS = { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 } as const;
const DK_LEN = 64;

function deriveKey(password: string, salt: string) {
	return scryptSync(password.normalize('NFKC'), Buffer.from(salt, 'utf8'), DK_LEN, SCRYPT_PARAMS);
}

/** Native node:crypto scrypt — compatible with better-auth's default hash format, but fast on CF Workers. */
export async function hashPassword(password: string) {
	const salt = randomBytes(16).toString('hex');
	const key = deriveKey(password, salt);
	return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
	const [salt, key] = hash.split(':');
	if (!salt || !key) return false;

	const derived = deriveKey(password, salt);
	const expected = Buffer.from(key, 'hex');
	if (derived.length !== expected.length) return false;

	return timingSafeEqual(derived, expected);
}
