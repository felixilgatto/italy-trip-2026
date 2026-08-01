import { isAuthed } from '$lib/server/auth.js';

export function load({ cookies }) {
	return { authed: isAuthed(cookies) };
}
