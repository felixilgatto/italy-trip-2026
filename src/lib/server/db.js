import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '$env/dynamic/private';

export const DATA_DIR = env.DATA_DIR || 'data';
fs.mkdirSync(path.join(DATA_DIR, 'photos'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    caption_en TEXT DEFAULT '',
    caption_fr TEXT DEFAULT '',
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    taken_at TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export function getPhotos() {
	return db
		.prepare('SELECT id, filename, mime, caption_en, caption_fr, lat, lng, taken_at, created_at FROM photos ORDER BY created_at DESC')
		.all();
}

export function getPhoto(id) {
	return db
		.prepare('SELECT id, filename, mime, caption_en, caption_fr, lat, lng, taken_at, created_at FROM photos WHERE id = ?')
		.get(id);
}

export function updatePhoto(id, { caption_en, caption_fr }) {
	db.prepare('UPDATE photos SET caption_en = ?, caption_fr = ? WHERE id = ?').run(
		caption_en || '',
		caption_fr || '',
		id
	);
	return getPhoto(id);
}

export function addPhoto({ filename, mime, caption_en, caption_fr, lat, lng, taken_at }) {
	const info = db
		.prepare(
			'INSERT INTO photos (filename, mime, caption_en, caption_fr, lat, lng, taken_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
		)
		.run(filename, mime, caption_en || '', caption_fr || '', lat, lng, taken_at || '');
	return getPhoto(info.lastInsertRowid);
}

export function deletePhoto(id) {
	const photo = getPhoto(id);
	if (photo) db.prepare('DELETE FROM photos WHERE id = ?').run(id);
	return photo;
}
