<script>
	import favicon from '$lib/assets/favicon.svg';
	import '@fontsource/caveat/500.css';
	import '@fontsource/lora/400.css';
	import '@fontsource/lora/600.css';
	import '@fontsource/short-stack/400.css';
	import { dicts, setLang } from '$lib/i18n/index.js';
	import { page } from '$app/state';

	let { children, data } = $props();

	const lang = $derived(data.lang === 'en' ? 'en' : 'fr');
	const d = $derived(dicts[lang]);
	const pathNoLang = $derived(page.url.pathname);
	const t = (key) => d.nav[key] ?? key;

	const langHref = (l) => {
		const qs = new URLSearchParams(page.url.searchParams);
		qs.set('lang', l);
		return `${pathNoLang}?${qs.toString()}`;
	};

	// svelte-ignore state_referenced_locally
	setLang(data.lang);
	$effect(() => {
		setLang(data.lang);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="description" content="Italy 2026 — backpacking trip map and photos" />
</svelte:head>

<header>
	<nav>
		<a class="brand" href="/?lang={lang}">{d.title}</a>
		<div class="links">
			<a href="/?lang={lang}">{t('home')}</a>
			<a href="/photos?lang={lang}">{t('photos')}</a>
			<a href="/upload?lang={lang}">{t('upload')}</a>
		</div>
		<div class="lang">
			<a class:active={lang === 'en'} href={langHref('en')}>EN</a>
			<a class:active={lang === 'fr'} href={langHref('fr')}>FR</a>
		</div>
	</nav>
</header>

<main>
	{@render children()}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Lora', Georgia, serif;
		color: #3a3328;
		background: #f6efdf;
	}

	:global(body)::after {
		content: '';
		position: fixed;
		inset: 0;
		z-index: 2147483000;
		pointer-events: none;
		opacity: 0.18;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
	}

	header {
		position: sticky;
		top: 0;
		z-index: 1000;
		background: #3b3126;
		color: #fff;
		height: 48px;
		border-bottom: 4px dashed #e8dcc0;
	}

	nav {
		height: 100%;
		max-width: 1100px;
		margin: 0 auto;
		padding: 0 20px;
		display: flex;
		align-items: center;
		gap: 24px;
	}

	.brand {
		font-family: 'Caveat', cursive;
		font-weight: 500;
		font-size: 1.55rem;
		color: #f5e9cf;
		text-decoration: none;
		letter-spacing: 0.02em;
		line-height: 1;
	}

	.links {
		display: flex;
		gap: 16px;
		flex: 1;
	}

	.links a {
		color: #d9cbb0;
		text-decoration: none;
		font-size: 1rem;
		font-family: 'Short Stack', cursive;
	}

	.links a:hover {
		color: #fff;
		text-decoration: underline wavy #e8a33d 1.5px;
		text-underline-offset: 4px;
	}

	.lang {
		display: flex;
		border: 1px solid #5c4f3d;
		border-radius: 6px;
		overflow: hidden;
	}

	.lang a {
		display: block;
		padding: 5px 12px;
		font-size: 0.9rem;
		font-family: 'Short Stack', cursive;
		text-decoration: none;
		color: #d9cbb0;
	}

	.lang a.active {
		background: #e8a33d;
		color: #2c2417;
		font-weight: 600;
	}

	:global(button),
	:global(input),
	:global(select),
	:global(textarea) {
		font-family: 'Short Stack', cursive;
	}

	main {
		width: 100%;
		padding: 0;
	}
</style>
