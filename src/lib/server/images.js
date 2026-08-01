import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { DATA_DIR } from './db.js';

const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

/**
 * MIME types that are safe to serve inline on our origin. Anything else is
 * stored/served as an opaque download so stored files can never render as
 * HTML/JS (note: image/svg+xml is deliberately excluded — SVG can carry scripts).
 */
export const SAFE_IMAGE_MIME = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/avif',
	'image/heic',
	'image/heif',
	'image/tiff'
]);

/** Name of the thumbnail file for a given display filename. */
export function thumbName(filename) {
	return `${filename}.thumb.jpg`;
}

/**
 * Convert an uploaded file into a display JPEG (+ 600px thumbnail).
 * Returns { display, ok } where ok=false means the file was not a
 * processable image (caller should fall back to saving the raw bytes).
 */
export async function processImage(inputPath, baseName) {
	try {
		const displayName = `${baseName}.jpg`;
		const displayPath = path.join(PHOTOS_DIR, displayName);
		const thumbPath = path.join(PHOTOS_DIR, thumbName(displayName));

		const img = sharp(inputPath, { failOn: 'none' }).rotate();

		await img
			.clone()
			.resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
			.jpeg({ quality: 85 })
			.toFile(displayPath);

		await img
			.clone()
			.resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
			.jpeg({ quality: 80 })
			.toFile(thumbPath);

		return { ok: true, filename: displayName };
	} catch {
		return { ok: false, filename: null };
	}
}

export function photoPaths(filename) {
	const display = path.join(PHOTOS_DIR, filename);
	const thumb = path.join(PHOTOS_DIR, thumbName(filename));
	return { display, thumb };
}

export function removePhotoFiles(filename) {
	const { display, thumb } = photoPaths(filename);
	for (const p of [display, thumb]) {
		try {
			fs.unlinkSync(p);
		} catch {
			// ignore missing
		}
	}
}
