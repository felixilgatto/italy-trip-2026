import { json, error } from '@sveltejs/kit';
import path from 'node:path';
import fs from 'node:fs';
import { DATA_DIR, getPhotos, addPhoto } from '$lib/server/db.js';
import { extractExif } from '$lib/server/exif.js';
import { isAuthed, checkPassword } from '$lib/server/auth.js';
import { processImage, SAFE_IMAGE_MIME } from '$lib/server/images.js';

const TMP_DIR = path.join(DATA_DIR, 'tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

export async function GET() {
	return json(getPhotos());
}

export async function POST({ request, cookies }) {
	const form = await request.formData();
	const authed = isAuthed(cookies) || checkPassword(form.get('password'));
	if (!authed) throw error(401, 'Unauthorized');

	const file = form.get('photo');
	if (!file || typeof file === 'string' || !file.arrayBuffer) {
		throw error(400, 'No photo provided');
	}

	const bytes = Buffer.from(await file.arrayBuffer());
	if (!bytes.length || bytes.length > 25 * 1024 * 1024) {
		throw error(400, 'Invalid file size (max 25 MB)');
	}

	const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const tmpPath = path.join(TMP_DIR, `${base}.tmp`);
	fs.writeFileSync(tmpPath, bytes);

	const exif = await extractExif(tmpPath);

	const toNum = (v) => {
		if (v === null || v === undefined || v === '') return NaN;
		return Number(v);
	};
	let lat = toNum(form.get('lat'));
	let lng = toNum(form.get('lng'));
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
		if (exif.lat !== null && exif.lng !== null) {
			lat = exif.lat;
			lng = exif.lng;
		} else {
			fs.unlinkSync(tmpPath);
			throw error(422, 'No location provided and no GPS in EXIF');
		}
	}

	const processed = await processImage(tmpPath, base);
	fs.unlinkSync(tmpPath);

	let filename;
	let mime;
	if (processed.ok) {
		filename = processed.filename;
		mime = 'image/jpeg';
	} else {
		// Not a processable image — store raw bytes as-is (no thumbnail).
		// Never trust the client MIME type: constrain it to safe image types so
		// stored files can't be served as HTML/JS from our origin.
		const ext = path.extname(file.name || '.jpg') || '.jpg';
		filename = `${base}${ext}`;
		mime = SAFE_IMAGE_MIME.has(file.type) ? file.type : 'application/octet-stream';
		fs.writeFileSync(path.join(DATA_DIR, 'photos', filename), bytes);
	}

	const photo = addPhoto({
		filename,
		mime,
		caption_en: String(form.get('caption_en') || ''),
		caption_fr: String(form.get('caption_fr') || ''),
		lat,
		lng,
		taken_at: String(form.get('taken_at') || exif.taken_at || '')
	});

	return json(photo, { status: 201 });
}
