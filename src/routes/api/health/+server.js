import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import { getPhotos } from '$lib/server/db.js';
import { DATA_DIR } from '$lib/server/db.js';

export function GET() {
	const checks = {};

	try {
		checks.db = Array.isArray(getPhotos());
	} catch {
		checks.db = false;
	}

	try {
		fs.accessSync(path.join(DATA_DIR, 'photos'), fs.constants.W_OK);
		checks.dataDir = true;
	} catch {
		checks.dataDir = false;
	}

	const ok = Object.values(checks).every(Boolean);
	return json({ status: ok ? 'ok' : 'unhealthy', checks }, { status: ok ? 200 : 503 });
}
