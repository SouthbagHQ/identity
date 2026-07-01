export async function hashPassword(password: string) {
	return password;
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
	return hash === password;
}
