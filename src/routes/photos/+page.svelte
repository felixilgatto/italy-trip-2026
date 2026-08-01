<script>
	import { onMount } from 'svelte';
	import { lang, dict } from '$lib/i18n/index.js';

	let { data } = $props();
	let authed = $state(false);
	let msg = $state('');
	// svelte-ignore state_referenced_locally
	let photos = $state.raw(data.photos);

	onMount(async () => {
		try {
			const res = await fetch('/api/auth/status');
			if (res.ok) authed = (await res.json()).authed;
		} catch {
			// offline
		}
	});

	function caption(p) {
		return p['caption_' + $lang] || p.caption_en || p.caption_fr;
	}

	async function del(p) {
		if (!confirm($dict.photos.deleteConfirm)) return;
		const res = await fetch(`/api/photos/${p.id}`, { method: 'DELETE' });
		if (res.ok) {
			msg = $dict.photos.deleted;
			photos = photos.filter((x) => x.id !== p.id);
		}
	}
</script>

<svelte:head>
	<title>{$dict.photos.title} — {$dict.title}</title>
</svelte:head>

<div class="page">
	<h1>{$dict.photos.title}</h1>

	{#if msg}<p class="ok">{msg}</p>{/if}

	{#if !photos.length}
		<p class="empty">{$dict.photos.empty}</p>
	{:else}
		<div class="grid">
			{#each photos as p (p.id)}
				<div class="item">
					<a href={`/photos/${p.id}?lang=${$lang}`}>
						<img
							src={`/photos/${p.id}/file?thumb=1&v=${encodeURIComponent(p.filename)}`}
							alt={caption(p)}
							loading="lazy"
							onerror={(e) =>
								(e.currentTarget.src = `/photos/${p.id}/file?v=${encodeURIComponent(p.filename)}`)} />
					</a>
					<div class="meta">
						{#if caption(p)}<span class="cap">{caption(p)}</span>{/if}
						<span class="actions">
							<a
								class="dl"
								href={`/photos/${p.id}/file?dl=1`}
								title={$dict.photo.download}
								aria-label={$dict.photo.download}>↓</a>
							{#if authed}
								<button class="del" onclick={() => del(p)} aria-label={$dict.photos.delete}>
									{$dict.photos.delete}
								</button>
							{/if}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 32px 20px 56px;
		max-width: 1100px;
		margin: 0 auto;
	}

	h1 {
		text-align: center;
		margin: 0 0 28px;
		font-family: 'Caveat', cursive;
		font-weight: 500;
		font-size: 2.6rem;
		color: #3b3126;
	}

	.ok {
		text-align: center;
		color: #1a7f37;
	}

	.empty {
		text-align: center;
		color: #6b5f4a;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 34px 20px;
	}

	.item {
		position: relative;
		background: #fffdf6;
		border: 1px solid #e2d7bd;
		padding: 10px 10px 12px;
		border-radius: 3px;
		box-shadow: 0 4px 14px rgba(80, 62, 30, 0.18);
		transform: rotate(-1.6deg);
		transition: transform 0.2s ease;
	}

	.item:nth-child(even) {
		transform: rotate(1.3deg);
	}

	.item:hover {
		transform: rotate(0deg) translateY(-4px);
	}

	.item::before {
		content: '';
		position: absolute;
		top: -12px;
		left: 50%;
		width: 92px;
		height: 24px;
		background: rgba(230, 193, 122, 0.55);
		box-shadow: 0 1px 2px rgba(80, 60, 20, 0.15);
		transform: translateX(-50%) rotate(-2deg);
	}

	.item a {
		display: block;
	}

	.item img {
		width: 100%;
		height: 190px;
		object-fit: cover;
		display: block;
		background: #eee;
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 4px 2px;
	}

	.cap {
		font-family: 'Caveat', cursive;
		font-weight: 500;
		font-size: 1.2rem;
		color: #3b3126;
		min-height: 1.2em;
		line-height: 1.1;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.dl {
		text-decoration: none;
		color: #3b3126;
		font-weight: 600;
		font-size: 0.95rem;
		border: 2px solid #3b3126;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		padding: 1px 12px;
	}

	.del {
		margin-left: auto;
		border: 2px solid #b4552d;
		background: transparent;
		color: #b4552d;
		border-radius: 225px 15px 255px 15px / 15px 225px 15px 255px;
		padding: 2px 10px;
		font-size: 0.78rem;
		cursor: pointer;
	}
</style>
