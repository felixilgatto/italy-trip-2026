import exifr from 'exifr';

export async function extractExif(filepath) {
	const meta = await exifr.parse(filepath, ['DateTimeOriginal']).catch(() => null);
	return { taken_at: meta?.DateTimeOriginal || '' };
}
