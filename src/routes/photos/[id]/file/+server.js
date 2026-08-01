import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';
import { DATA_DIR, getPhoto } from '$lib/server/db.js';
import { SAFE_IMAGE_MIME, thumbName } from '$lib/server/images.js';

export async function GET({ params, url }) {
	const photo = getPhoto(Number(params.id));
	if (!photo) throw error(404, 'Not found');

	const isThumb = url.searchParams.has('thumb');
	const isDownload = url.searchParams.has('dl');

	let filename = photo.filename;
	let mime = photo.mime || 'image/jpeg';
	if (isThumb) {
		filename = thumbName(photo.filename);
		mime = 'image/jpeg';
	}

	const fullpath = path.join(DATA_DIR, 'photos', filename);
	if (!fs.existsSync(fullpath)) throw error(404, 'Not found');
	const body = await readFile(fullpath);

	const headers = {
		'x-content-type-options': 'nosniff',
		'cache-control': 'public, max-age=31536000, immutable'
	};
	if (isDownload) {
		const ext = isThumb ? '.jpg' : path.extname(photo.filename) || '.jpg';
		const name = `${photo.id}${ext}`;
		headers['content-type'] = mime;
		headers['content-disposition'] = `attachment; filename="${name}"`;
	} else if (SAFE_IMAGE_MIME.has(mime)) {
		headers['content-type'] = mime;
	} else {
		headers['content-type'] = 'application/octet-stream';
		headers['content-disposition'] = 'attachment';
	}

	return new Response(body, { headers });
}
