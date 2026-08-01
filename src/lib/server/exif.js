import exifr from 'exifr';

export async function extractExif(filepath) {
	const gps = await exifr.gps(filepath).catch(() => null);
	const meta = await exifr.parse(filepath, ['DateTimeOriginal']).catch(() => null);

	let lat = null;
	let lng = null;
	if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
		lat = gps.latitude;
		lng = gps.longitude;
	}

	return { lat, lng, taken_at: meta?.DateTimeOriginal || '' };
}
