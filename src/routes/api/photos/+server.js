import { json, error } from '@sveltejs/kit';
import path from 'node:path';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DATA_DIR, getPhotos, addPhoto } from '$lib/server/db.js';
import { extractExif } from '$lib/server/exif.js';
import { isAuthed, checkPassword } from '$lib/server/auth.js';
import { processImage, SAFE_IMAGE_MIME, removePhotoFiles } from '$lib/server/images.js';

const TMP_DIR = path.join(DATA_DIR, 'tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

const MAX_MB = 25;
const MAX_BYTES = MAX_MB * 1024 * 1024;

/** Write a web ReadableStream to disk, rejecting on error. */
function writeStream(readable, filePath) {
	return pipeline(Readable.fromWeb(readable), fs.createWriteStream(filePath));
}

export async function GET() {
	return json(getPhotos());
}

export async function POST({ request, cookies }) {
	const length = Number(request.headers.get('content-length'));
	if (Number.isFinite(length) && length > MAX_BYTES + 128 * 1024) {
		throw error(413, `File too large (max ${MAX_MB} MB)`);
	}

	const form = await request.formData();
	const authed = isAuthed(cookies) || checkPassword(form.get('password'));
	if (!authed) throw error(401, 'Unauthorized');

	const file = form.get('photo');
	if (!file || typeof file === 'string' || !file.stream || !file.size) {
		throw error(400, 'No photo provided');
	}

	if (file.size > MAX_BYTES) {
		throw error(413, `File too large (max ${MAX_MB} MB)`);
	}

	const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const tmpPath = path.join(TMP_DIR, `${base}.tmp`);
	let filename = null;
	let photoAdded = false;

	try {
		await writeStream(file.stream(), tmpPath);

		const exif = await extractExif(tmpPath);

		const toNum = (v) => {
			if (v === null || v === undefined || v === '') return NaN;
			return Number(v);
		};
		const lat = toNum(form.get('lat'));
		const lng = toNum(form.get('lng'));
		if (
			!Number.isFinite(lat) ||
			!Number.isFinite(lng) ||
			Math.abs(lat) > 90 ||
			Math.abs(lng) > 180
		) {
			throw error(422, 'No location provided');
		}

		const processed = await processImage(tmpPath, base);

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
			fs.copyFileSync(tmpPath, path.join(DATA_DIR, 'photos', filename));
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
		photoAdded = true;

		return json(photo, { status: 201 });
	} finally {
		try {
			fs.unlinkSync(tmpPath);
		} catch {
			// already gone
		}
		if (!photoAdded && filename) {
			try {
				removePhotoFiles(filename);
			} catch {
				// best-effort cleanup
			}
		}
	}
}
