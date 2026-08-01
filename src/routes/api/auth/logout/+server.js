import { json } from '@sveltejs/kit';
import { COOKIE_NAME, SESSION_OPTIONS } from '$lib/server/auth.js';

export function POST({ cookies }) {
	cookies.delete(COOKIE_NAME, { ...SESSION_OPTIONS, maxAge: 0 });
	return json({ ok: true });
}
