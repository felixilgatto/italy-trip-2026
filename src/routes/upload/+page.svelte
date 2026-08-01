<script>
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import exifr from 'exifr';
	import { lang, dict } from '$lib/i18n/index.js';

	let authed = $state(false);
	let password = $state('');
	let loginError = $state('');
	let logginIn = $state(false);

	let files = $state([]);
	let batchLat = $state(null);
	let batchLng = $state(null);
	let geoMsg = $state('');
	let uploading = $state(false);
	let uploadMsg = $state('');
	let uploadErr = $state('');

	let L;
	let map;
	let marker;
	let fileInput = $state(null);

	onMount(async () => {
		L = (await import('leaflet')).default;
		try {
			const res = await fetch('/api/auth/status');
			if (res.ok) {
				const data = await res.json();
				authed = data.authed;
			}
		} catch {
			// offline
		}
	});

	$effect(() => {
		if (authed && !map && L) initMap();
	});

	function pinIcon() {
		return L.divIcon({
			className: 'photo-pin',
			html: '<svg width="28" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0z" fill="#e85d3f" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="#ffffff"/></svg>',
			iconSize: [28, 40],
			iconAnchor: [14, 40],
			popupAnchor: [0, -40]
		});
	}

	function initMap() {
		map = L.map('upload-map', { scrollWheelZoom: true }).setView([41.0, 13.5], 6);
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
		}).addTo(map);
		marker = L.marker([41.0, 13.5], { draggable: true, icon: pinIcon() }).addTo(map);
		marker.on('dragend', () => setCoords(marker.getLatLng()));
		map.on('click', (e) => {
			marker.setLatLng(e.latlng);
			setCoords(e.latlng);
		});
	}

	function setCoords({ lat, lng }) {
		batchLat = lat;
		batchLng = lng;
		geoMsg = '';
	}

	async function login() {
		loginError = '';
		logginIn = true;
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ password })
			});
			if (res.ok) {
				authed = true;
			} else {
				loginError = $dict.upload.wrongPassword;
			}
		} catch {
			loginError = $dict.upload.error;
		}
		logginIn = false;
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		authed = false;
		password = '';
		files = [];
	}

	async function onFiles(e) {
		const selected = [...(e.target.files || [])];
		if (!selected.length) return;
		uploadMsg = '';
		uploadErr = '';
		batchLat = null;
		batchLng = null;
		geoMsg = '';

		const added = [];
		for (const file of selected) {
			added.push({
				file,
				url: URL.createObjectURL(file),
				caption_en: '',
				caption_fr: '',
				taken_at: '',
				geo: null
			});
		}
		files = [...files, ...added];

		let gpsFound = null;
		for (const entry of added) {
			try {
				const [gps, meta] = await Promise.all([
					exifr.gps(entry.file),
					exifr.parse(entry.file, ['DateTimeOriginal']).catch(() => null)
				]);
				if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
					entry.geo = { lat: gps.latitude, lng: gps.longitude };
					if (!gpsFound) gpsFound = entry.geo;
				}
				if (meta?.DateTimeOriginal) entry.taken_at = meta.DateTimeOriginal;
			} catch {
				// ignore
			}
		}

		if (gpsFound) {
			marker?.setLatLng([gpsFound.lat, gpsFound.lng]);
			map?.setView([gpsFound.lat, gpsFound.lng], 12);
			setCoords(gpsFound);
			geoMsg = $dict.upload.geoDetected;
		} else {
			geoMsg = $dict.upload.geoMissing;
		}
	}

	function removeFile(i) {
		URL.revokeObjectURL(files[i].url);
		files.splice(i, 1);
		if (!files.length) {
			batchLat = null;
			batchLng = null;
			geoMsg = '';
		}
	}

	async function submit() {
		if (!files.length) return;
		if (batchLat === null || batchLng === null) {
			uploadErr = $dict.upload.geoMissing;
			return;
		}
		uploading = true;
		uploadErr = '';
		uploadMsg = '';
		try {
			const total = files.length;
			const results = await Promise.all(
				files.map(async (entry) => {
					const fd = new FormData();
					fd.append('photo', entry.file);
					fd.append('lat', String(batchLat));
					fd.append('lng', String(batchLng));
					fd.append('caption_en', entry.caption_en);
					fd.append('caption_fr', entry.caption_fr);
					fd.append('taken_at', entry.taken_at);
					const res = await fetch('/api/photos', { method: 'POST', body: fd });
					return res.ok;
				})
			);
			const ok = results.filter(Boolean).length;
			if (ok === total) {
				uploadMsg = $dict.upload.success;
				for (const entry of files) URL.revokeObjectURL(entry.url);
				files = [];
				batchLat = null;
				batchLng = null;
				geoMsg = '';
				if (fileInput) fileInput.value = '';
				if (marker) marker.setLatLng([41.0, 13.5]);
				if (map) map.setView([41.0, 13.5], 6);
			} else {
				files = files.filter((_, i) => !results[i]);
				uploadErr = $dict.upload.partial
					.replace('{ok}', String(ok))
					.replace('{total}', String(total));
			}
		} catch {
			uploadErr = $dict.upload.error;
		}
		uploading = false;
	}

	const countLabel = $derived(
		$dict.upload.selectedCount.replace('{n}', String(files.length))
	);
</script>

<svelte:head>
	<title>{$dict.upload.title} — {$dict.title}</title>
</svelte:head>

<div class="page">
	<h1>{$dict.upload.title}</h1>

{#if !authed}
	<section class="card">
		<h2>{$dict.upload.loginTitle}</h2>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				login();
			}}
		>
			<label>
				{$dict.upload.password}
				<input type="password" bind:value={password} autocomplete="current-password" />
			</label>
			{#if loginError}<p class="err">{loginError}</p>{/if}
			<button type="submit" disabled={logginIn}>{logginIn ? '…' : $dict.upload.login}</button>
		</form>
	</section>
{:else}
	<section class="card">
		<div class="topbar">
			<h2>{$dict.upload.addPhoto}</h2>
			<button class="ghost" onclick={logout}>{$dict.upload.logout}</button>
		</div>

		<input accept="image/*" multiple type="file" bind:this={fileInput} onchange={onFiles} />

		{#if files.length}
			<p class="count">{countLabel}</p>
		{/if}

		<div class="map-wrap">
			<div id="upload-map"></div>
			{#if geoMsg}
				<p class="hint">
					{geoMsg}
					<br />
					<small>{$dict.upload.clickToPlace}</small>
				</p>
			{/if}
		</div>

		{#if files.length}
			<div class="list">
				{#each files as entry, i (entry.url)}
					<div class="item">
						<img src={entry.url} alt="" />
						<div class="fields">
							<label>
								{$dict.upload.captionEn}
								<input type="text" bind:value={entry.caption_en} maxlength="200" />
							</label>
							<label>
								{$dict.upload.captionFr}
								<input type="text" bind:value={entry.caption_fr} maxlength="200" />
							</label>
						</div>
						<button class="ghost small" onclick={() => removeFile(i)}>{$dict.upload.remove}</button>
					</div>
				{/each}
			</div>
		{/if}

		{#if uploadMsg}<p class="ok">{uploadMsg}</p>{/if}
		{#if uploadErr}<p class="err">{uploadErr}</p>{/if}
		<button onclick={submit} disabled={uploading || !files.length}>
			{uploading ? $dict.upload.uploading : $dict.upload.submit}
		</button>
	</section>
{/if}
</div>

<style>
	.page {
		padding: 24px 16px 48px;
	}

	.card {
		background: #fffdf6;
		border: 2px solid #a08d6e;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		padding: 24px;
		max-width: 620px;
		margin: 0 auto;
		box-shadow: 0 6px 22px rgba(80, 62, 30, 0.2);
	}

	h2 {
		margin-top: 0;
		font-family: 'Caveat', cursive;
		font-weight: 500;
		font-size: 1.8rem;
	}

	form,
	.card {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.9rem;
		color: #6b5f4a;
	}

	input[type='text'],
	input[type='password'] {
		padding: 10px 12px;
		border: 2px solid #a08d6e;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		font-size: 1rem;
		font-family: inherit;
		background: #fffdf6;
		color: #3b3126;
	}

	input[type='file'] {
		padding: 8px 0;
	}

	button {
		padding: 10px 18px;
		border: 2px solid #3b3126;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		background: #fffdf6;
		color: #3b3126;
		font-size: 1rem;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background: #f3e9d0;
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	button.ghost {
		background: transparent;
		border-style: dashed;
		padding: 6px 12px;
		font-size: 0.85rem;
	}

	button.small {
		padding: 5px 10px;
		font-size: 0.8rem;
		white-space: nowrap;
		align-self: center;
	}

	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.page h1 {
		text-align: center;
		font-family: 'Caveat', cursive;
		font-weight: 500;
		font-size: 2.4rem;
		color: #3b3126;
	}

	.count {
		margin: 0;
		color: #6b5f4a;
		font-size: 0.9rem;
	}

	.map-wrap {
		position: relative;
		height: 320px;
		border-radius: 12px;
		overflow: hidden;
		border: 2px solid #a08d6e;
	}

	#upload-map {
		height: 100%;
		width: 100%;
	}

	.hint {
		position: absolute;
		left: 10px;
		right: 10px;
		bottom: 10px;
		margin: 0;
		background: rgba(59, 49, 38, 0.9);
		color: #f5e9cf;
		border-radius: 8px;
		padding: 8px 12px;
		font-size: 0.85rem;
	}

	.hint small {
		opacity: 0.75;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-height: 320px;
		overflow-y: auto;
	}

	.item {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		background: #fffdf6;
		border: 2px solid #d9cbb0;
		border-radius: 10px;
		padding: 10px;
	}

	.item img {
		width: 64px;
		height: 64px;
		object-fit: cover;
		border-radius: 6px;
		flex-shrink: 0;
		border: 1px solid #e2d7bd;
	}

	.fields {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.fields label {
		gap: 3px;
	}

	.ok {
		color: #1a7f37;
		font-size: 0.95rem;
		margin: 0;
	}

	.err {
		color: #b4552d;
		font-size: 0.95rem;
		margin: 0;
	}

	:global(.photo-pin) {
		background: none;
		border: none;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
	}
</style>
