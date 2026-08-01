import { json } from '@sveltejs/kit';
import { isAuthed } from '$lib/server/auth.js';

export function GET({ cookies }) {
	return json({ authed: isAuthed(cookies) });
}
