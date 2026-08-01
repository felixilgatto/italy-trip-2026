import { getPhotos } from '$lib/server/db.js';

export function load() {
	return { photos: getPhotos() };
}
