import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '$env/dynamic/private';

export const COOKIE_NAME = 'trip_auth';

export const SESSION_OPTIONS = {
	httpOnly: true,
	sameSite: 'lax',
	secure: env.COOKIE_SECURE === 'true',
	path: '/',
	maxAge: 60 * 60 * 24 * 7 // 7 days
};

const SESSION_SECRET = env.SESSION_SECRET || (import.meta.env.DEV ? 'dev-secret-change-me' : null);

function sign(payload) {
	if (!SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
	return createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
}

function safeEqual(a, b) {
	const ba = Buffer.from(String(a));
	const bb = Buffer.from(String(b));
	if (ba.length !== bb.length) return false;
	return timingSafeEqual(ba, bb);
}

export function checkPassword(password) {
	if (!password) return false;
	const hash = env.UPLOAD_PASSWORD_HASH;
	const plain = env.UPLOAD_PASSWORD;
	if (hash) return bcrypt.compareSync(password, hash);
	if (plain) return safeEqual(password, plain);
	return false;
}

export function createSessionToken() {
	const payload = String(Date.now());
	return `${payload}.${sign(payload)}`;
}

export function isAuthed(cookies) {
	const value = cookies.get(COOKIE_NAME);
	if (!value) return false;
	const [payload, sig] = String(value).split('.');
	if (!payload || !sig) return false;
	try {
		return safeEqual(sig, sign(payload));
	} catch {
		return false;
	}
}
