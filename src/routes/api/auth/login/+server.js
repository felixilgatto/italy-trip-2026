import { json, error } from '@sveltejs/kit';
import { checkPassword, createSessionToken, COOKIE_NAME, SESSION_OPTIONS } from '$lib/server/auth.js';

export async function POST({ request, cookies }) {
	const { password } = await request.json().catch(() => ({}));
	if (!checkPassword(password)) throw error(401, 'Unauthorized');
	cookies.set(COOKIE_NAME, createSessionToken(), SESSION_OPTIONS);
	return json({ ok: true });
}
