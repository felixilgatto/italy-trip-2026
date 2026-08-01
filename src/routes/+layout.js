export function load({ url }) {
	return { lang: url.searchParams.get('lang') === 'en' ? 'en' : 'fr' };
}
