<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { lang, dict } from '$lib/i18n/index.js';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let photo = $state.raw(data.photo);
	let authed = $state(false);
	let editing = $state(false);
	// svelte-ignore state_referenced_locally
	let caption_en = $state(photo.caption_en || '');
	// svelte-ignore state_referenced_locally
	let caption_fr = $state(photo.caption_fr || '');
	let msg = $state('');
	let err = $state('');
	let deleting = $state(false);

	const p = $derived(photo);

	const caption = $derived(p['caption_' + $lang] || p.caption_en || p.caption_fr);
	const date = $derived(
		p.taken_at ? new Date(p.taken_at).toLocaleDateString($lang === 'fr' ? 'fr-FR' : 'en-GB') : ''
	);

	onMount(async () => {
		try {
			const res = await fetch('/api/auth/status');
			if (res.ok) authed = (await res.json()).authed;
		} catch {
			// offline
		}
	});

	async function save() {
		err = '';
		msg = '';
		const res = await fetch(`/api/photos/${p.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ caption_en, caption_fr })
		});
		if (res.ok) {
			photo = await res.json();
			msg = $dict.photo.saved;
			editing = false;
		} else {
			err = $dict.upload.error;
		}
	}

	async function del() {
		if (!confirm($dict.photos.deleteConfirm)) return;
		deleting = true;
		const res = await fetch(`/api/photos/${p.id}`, { method: 'DELETE' });
		if (res.ok) {
			goto(`/photos?lang=${$lang}`);
		} else {
			err = $dict.upload.error;
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>{caption || $dict.title} — {$dict.title}</title>
</svelte:head>

<div class="page">
	<nav class="top">
		<a class="back" href={`/photos?lang=${$lang}`}>← {$dict.photo.back}</a>
		{#if !authed}
			<a class="map-link" href={`/?lang=${$lang}&focus=${p.id}`}>🗺 {$dict.photo.onMap}</a>
		{/if}
	</nav>

	<figure>
		<img src={`/photos/${p.id}/file?v=${encodeURIComponent(p.filename)}`} alt={caption} />
		<figcaption>
			{#if editing}
				<label>
					{$dict.upload.captionEn}
					<input type="text" bind:value={caption_en} maxlength="200" />
				</label>
				<label>
					{$dict.upload.captionFr}
					<input type="text" bind:value={caption_fr} maxlength="200" />
				</label>
				<div class="row">
					<button onclick={save}>{$dict.photo.save}</button>
					<button class="ghost" onclick={() => (editing = false)}>{$dict.photo.back}</button>
				</div>
			{:else}
				{#if caption}<div class="cap">{caption}</div>{/if}
				{#if date}<div class="date">{date}</div>{/if}
			{/if}
			{#if msg}<p class="ok">{msg}</p>{/if}
			{#if err}<p class="err">{err}</p>{/if}

			<div class="row">
				<a class="dl" href={`/photos/${p.id}/file?dl=1`}>↓ {$dict.photo.download}</a>
				{#if authed && !editing}
					<button class="ghost" onclick={() => (editing = true)}>{$dict.photo.edit}</button>
				{/if}
				{#if authed}
					<button class="danger" onclick={del} disabled={deleting}>
						{deleting ? '…' : $dict.photo.delete}
					</button>
				{/if}
			</div>
		</figcaption>
	</figure>
</div>

<style>
	.page {
		padding: 28px 20px 56px;
		max-width: 1000px;
		margin: 0 auto;
	}

	.top {
		display: flex;
		justify-content: space-between;
		margin-bottom: 16px;
	}

	.back {
		color: #3b3126;
		text-decoration: none;
		font-size: 0.95rem;
	}

	.back:hover {
		text-decoration: underline wavy #e8a33d 1.5px;
		text-underline-offset: 4px;
	}

	.map-link {
		color: #3b3126;
		text-decoration: none;
		font-size: 0.95rem;
	}

	figure {
		margin: 0;
		background: #fffdf6;
		border: 1px solid #e2d7bd;
		padding: 14px 14px 20px;
		border-radius: 4px;
		box-shadow: 0 6px 22px rgba(80, 62, 30, 0.2);
		transform: rotate(-0.6deg);
	}

	figure img {
		width: 100%;
		max-height: 74vh;
		object-fit: contain;
		display: block;
		background: #efead9;
	}

	figcaption {
		padding: 16px 8px 0;
		color: #3b3126;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.cap {
		font-family: 'Caveat', cursive;
		font-weight: 500;
		font-size: 1.7rem;
		line-height: 1.15;
	}

	.date {
		color: #6b5f4a;
		font-size: 0.9rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.85rem;
		color: #6b5f4a;
	}

	input {
		padding: 10px 12px;
		border: 2px solid #a08d6e;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		background: #fffdf6;
		color: #3b3126;
		font-size: 1rem;
		font-family: inherit;
	}

	.row {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: center;
	}

	button {
		padding: 9px 18px;
		border: 2px solid #3b3126;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		background: #fffdf6;
		color: #3b3126;
		font-size: 0.95rem;
		cursor: pointer;
	}

	button:hover {
		background: #f3e9d0;
	}

	button.ghost {
		background: transparent;
		border-style: dashed;
	}

	button.danger {
		border-color: #b4552d;
		color: #b4552d;
	}

	button:disabled {
		opacity: 0.5;
	}

	.dl {
		display: inline-block;
		padding: 9px 18px;
		border: 2px solid #3b3126;
		border-radius: 225px 15px 255px 15px / 15px 225px 15px 255px;
		background: #fffdf6;
		color: #3b3126;
		text-decoration: none;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.dl:hover {
		background: #f3e9d0;
	}

	.ok {
		color: #1a7f37;
		margin: 0;
	}

	.err {
		color: #b4552d;
		margin: 0;
	}
</style>
