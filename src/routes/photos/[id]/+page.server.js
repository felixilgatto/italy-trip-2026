import { error } from '@sveltejs/kit';
import { getPhoto } from '$lib/server/db.js';

export function load({ params }) {
	const photo = getPhoto(Number(params.id));
	if (!photo) throw error(404, 'Photo not found');
	return { photo };
}
