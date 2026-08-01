export function load({ data, url }) {
	return { ...data, lang: url.searchParams.get('lang') === 'en' ? 'en' : 'fr' };
}
