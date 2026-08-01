import { json, error } from '@sveltejs/kit';
import { getPhoto, updatePhoto, deletePhoto } from '$lib/server/db.js';
import { removePhotoFiles } from '$lib/server/images.js';
import { isAuthed, checkPassword } from '$lib/server/auth.js';

export async function PATCH({ request, params, cookies }) {
	const { password, caption_en, caption_fr } = await request.json().catch(() => ({}));
	if (!isAuthed(cookies) && !checkPassword(password)) throw error(401, 'Unauthorized');

	const id = Number(params.id);
	const existing = getPhoto(id);
	if (!existing) throw error(404, 'Not found');

	const photo = updatePhoto(id, { caption_en, caption_fr });
	return json(photo);
}

export async function DELETE({ request, params, cookies }) {
	const { password } = await request.json().catch(() => ({}));
	if (!isAuthed(cookies) && !checkPassword(password)) throw error(401, 'Unauthorized');

	const id = Number(params.id);
	const existing = getPhoto(id);
	if (!existing) throw error(404, 'Not found');

	removePhotoFiles(existing.filename);
	deletePhoto(id);
	return json({ ok: true });
}
