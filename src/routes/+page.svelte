<script>
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import { stops, route } from '$lib/data/stops.js';
	import { lang, dict } from '$lib/i18n/index.js';
	import { page } from '$app/state';
	import {
		resolveAt,
		animationSecondsAt,
		DEFAULT_SPEED,
		SPEED_OPTIONS,
		totalMs,
		startMs
	} from '$lib/data/itinerary.js';

	const DAY_MS = 86400000;
	const dayCount = Math.max(1, Math.ceil(totalMs / DAY_MS));
	const dayIndices = Array.from({ length: dayCount });

	let L;
	let map;
	let layerGroup;
	let photoMarkers = [];
	let travelMarker;
	let iconCache = {};
	let rafId;
	let curIcon;
	let frac = 0;
	let lastNow = 0;
	let photos = $state([]);
	let loading = $state(true);
	let panelOpen = $state(true);
	let speed = $state(DEFAULT_SPEED);
	let simText = $state('');
	let dayIndex = $state(0);
	let progPct = $state(0);
	let paused = $state(false);
	let dragging = false;
	let trackEl;

	function dayLabel(i) {
		const loc = $lang === 'fr' ? 'fr-FR' : 'en-GB';
		return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }).format(
			new Date(startMs + i * DAY_MS)
		);
	}

	$effect(() => {
		// re-render labels when language changes
		void $dict;
		void $lang;
		if (map) redraw();
	});

	onMount(async () => {
		L = (await import('leaflet')).default;

		map = L.map('map', {
			scrollWheelZoom: true,
			zoomControl: false
		}).setView([41.0, 12.5], 5);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
		}).addTo(map);

		L.polyline(route, { color: '#b4552d', weight: 4, opacity: 0.85 }).addTo(map);

		layerGroup = L.layerGroup().addTo(map);

		redraw();

		try {
			const res = await fetch('/api/photos');
			if (res.ok) photos = await res.json();
		} catch {
			// ignore, map still works
		}
		redraw();

		const all = [stops.map((s) => [s.lat, s.lng]), photos.map((p) => [p.lat, p.lng])].flat();
		map.fitBounds(L.latLngBounds(all).pad(0.15), { maxZoom: 9 });

		travelMarker = L.marker([0, 0], {
			icon: iconFor('🚆'),
			interactive: false,
			zIndexOffset: 500
		}).addTo(map);

		const start = resolveAt(0);
		simText = formatSim(start.date);
		startLoop();

		const focus = Number(page.url.searchParams.get('focus'));
		if (focus && photos.some((p) => p.id === focus)) {
			openPhotoPopup(focus);
		}

		loading = false;

		return () => {
			if (rafId) cancelAnimationFrame(rafId);
			if (travelMarker) travelMarker.remove();
		};
	});

	function iconFor(emoji) {
		let ic = iconCache[emoji];
		if (!ic) {
			ic = L.divIcon({
				className: 'travel-icon',
				html: `<span class="ti">${emoji}</span>`,
				iconSize: [36, 36],
				iconAnchor: [18, 18]
			});
			iconCache[emoji] = ic;
		}
		return ic;
	}

	function checkerIcon() {
		const svg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="ck" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#1c1c1e"/><rect width="4" height="4" fill="#ffffff"/><rect x="4" y="4" width="4" height="4" fill="#ffffff"/></pattern></defs><circle cx="12" cy="12" r="10" fill="url(#ck)" stroke="#ffffff" stroke-width="3"/></svg>`;
		return L.divIcon({
			className: 'se-icon',
			html: svg,
			iconSize: [24, 24],
			iconAnchor: [12, 12]
		});
	}

	function formatSim(date) {
		const loc = $lang === 'fr' ? 'fr-FR' : 'en-GB';
		const d = new Intl.DateTimeFormat(loc, {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		}).format(date);
		const h = String(date.getHours()).padStart(2, '0');
		return `${d} — ${h}${$lang === 'fr' ? 'h' : ''}`;
	}

	function applyFrac() {
		const { lat, lng, icon, date } = resolveAt(frac);
		progPct = frac * 100;
		dayIndex = Math.min(dayCount - 1, Math.max(0, Math.round(frac * (dayCount - 1))));
		travelMarker.setLatLng([lat, lng]);
		if (icon !== curIcon) {
			curIcon = icon;
			travelMarker.setIcon(iconFor(icon));
		}
		simText = formatSim(date);
	}

	function startLoop() {
		if (rafId || !map || !travelMarker) return;
		lastNow = 0;
		rafId = requestAnimationFrame(tick);
	}

	function stopLoop() {
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	function tick(now) {
		if (!map || !travelMarker) return;
		if (!lastNow) lastNow = now;
		const dt = Math.min((now - lastNow) / 1000, 0.1);
		lastNow = now;
		frac = (frac + dt / animationSecondsAt(speed)) % 1;
		applyFrac();
		rafId = requestAnimationFrame(tick);
	}

	function scrubAt(clientX) {
		if (!trackEl) return;
		const rect = trackEl.getBoundingClientRect();
		frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
		applyFrac();
	}

	function onTrackDown(e) {
		dragging = true;
		stopLoop();
		trackEl.setPointerCapture(e.pointerId);
		scrubAt(e.clientX);
	}

	function onTrackMove(e) {
		if (dragging) scrubAt(e.clientX);
	}

	function onTrackUp() {
		dragging = false;
		if (!paused) startLoop();
	}

	function onTrackKey(e) {
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
			e.preventDefault();
			jumpToDay(Math.min(dayCount - 1, dayIndex + 1));
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
			e.preventDefault();
			jumpToDay(Math.max(0, dayIndex - 1));
		} else if (e.key === 'Home') {
			e.preventDefault();
			jumpToDay(0);
		} else if (e.key === 'End') {
			e.preventDefault();
			jumpToDay(dayCount - 1);
		}
	}

	function cycleSpeed() {
		const i = SPEED_OPTIONS.indexOf(speed);
		speed = SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length];
	}

	function togglePause() {
		paused = !paused;
		if (paused) stopLoop();
		else startLoop();
	}

	function jumpToDay(i) {
		frac = Math.min(1, (i * DAY_MS) / totalMs);
		applyFrac();
	}

	function redraw() {
		layerGroup.clearLayers();
		photoMarkers = [];

		const first = route[0];
		const last = route[route.length - 1];
		const isEnd = (s) =>
			(s.lat === first[0] && s.lng === first[1]) || (s.lat === last[0] && s.lng === last[1]);

		for (const s of stops) {
			if (isEnd(s)) {
				L.marker([s.lat, s.lng], { icon: checkerIcon() })
					.addTo(layerGroup)
					.bindPopup(stopHtml(s));
			} else {
				L.circleMarker([s.lat, s.lng], {
					radius: 10,
					color: '#fff',
					weight: 3,
					fillColor: '#1c1c1e',
					fillOpacity: 1
				})
					.addTo(layerGroup)
					.bindPopup(stopHtml(s));
			}
		}

		for (const p of photos) {
			const marker = L.circleMarker([p.lat, p.lng], {
				radius: 7,
				color: '#fff',
				weight: 2,
				fillColor: '#e85d3f',
				fillOpacity: 1
			})
				.addTo(layerGroup)
				.bindPopup(photoHtml(p), { maxWidth: 340 });
			photoMarkers.push({ id: p.id, marker });
		}
	}

	function openPhotoPopup(id) {
		const found = photoMarkers.find((m) => m.id === id);
		if (found && map) {
			map.flyTo(found.marker.getLatLng(), Math.max(map.getZoom(), 11));
			found.marker.openPopup();
		}
	}

	function esc(s) {
		return String(s).replace(/[&<>"']/g, (c) => {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}

	function stopHtml(s) {
		const d = $dict;
		const name = esc(s.name[$lang] || s.name.en);
		return `<b>${name}</b><br>${esc(s.dates[$lang] || s.dates.en)}<br><em>${esc(d.stop.transport)}:</em> ${esc(s.transport[$lang] || s.transport.en)}<br><em>${esc(d.stop.stay)}:</em> ${esc(s.note[$lang] || s.note.en)}`;
	}

	function photoHtml(p) {
		const caption = esc(p['caption_' + $lang] || p.caption_en || p.caption_fr);
		const date = p.taken_at
			? new Date(p.taken_at).toLocaleDateString($lang === 'fr' ? 'fr-FR' : 'en-GB')
			: '';
		const v = encodeURIComponent(p.filename);
		return `<a href="/photos/${p.id}?lang=${esc($lang)}" class="pp"><img src="/photos/${p.id}/file?thumb=1&v=${v}" onerror="this.src='/photos/${p.id}/file?v=${v}'" alt="" loading="lazy"></a>${caption ? `<div class="pc">${caption}</div>` : ''}${date ? `<div class="pd">${esc(date)}</div>` : ''}`;
	}
</script>

<svelte:head>
	<title>{$dict.title} — {$dict.subtitle}</title>
</svelte:head>

<div class="map-wrap">
	{#if loading}
		<div class="spinner">…</div>
	{/if}
	<div id="map"></div>

	<div class="sim">
		<div class="sim-top">
			<div class="sim-date">{simText}</div>
			<div class="sim-ctls">
				<button
					class="sim-ctl-btn"
					onclick={togglePause}
					title={paused ? $dict.map.resume : $dict.map.pause}
					aria-label={paused ? $dict.map.resume : $dict.map.pause}
				>{paused ? '▶︎' : '⏸︎'}</button>
				<button
					class="sim-ctl-btn"
					onclick={cycleSpeed}
					title={`${$dict.map.speed}: ${speed}×`}
					aria-label={`${$dict.map.speed}: ${speed}×`}
				>{speed}×</button>
			</div>
		</div>
		<div class="journey">
			<div
				class="journey-track"
				bind:this={trackEl}
				role="slider"
				tabindex="0"
				aria-label={$dict.map.journey}
				aria-valuemin="0"
				aria-valuemax={dayCount - 1}
				aria-valuenow={dayIndex}
				aria-valuetext={dayLabel(dayIndex)}
				onpointerdown={onTrackDown}
				onpointermove={onTrackMove}
				onpointerup={onTrackUp}
				onpointercancel={onTrackUp}
				onlostpointercapture={onTrackUp}
				onkeydown={onTrackKey}
			>
				<div
					class="journey-line"
					style="background: linear-gradient(to right, #b4552d {progPct}%, #e2d7bd {progPct}%)"
				></div>
				{#each dayIndices as _, i (i)}
					<span
						class="journey-tick"
						class:active={i === dayIndex}
						class:done={i < dayIndex}
						style="left: {i / (dayCount - 1) * 100}%"
					></span>
				{/each}
			</div>
		</div>
	</div>

	<div
		class="panel"
		class:hidden={!panelOpen}
		role="button"
		tabindex="0"
		aria-label={$dict.map.stops}
		onclick={() => (panelOpen = false)}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				panelOpen = false;
			}
		}}
	>
		<button class="close" onclick={() => (panelOpen = false)} aria-label="Close">×</button>
		<h1>{$dict.title}</h1>
		<p>{$dict.subtitle}</p>
		<div class="counts">
			<span>{$dict.map.stops}: {stops.length}</span>
			<span>{$dict.map.photos}: {photos.length}</span>
		</div>
	</div>
	{#if !panelOpen}
		<button class="reopen" onclick={() => (panelOpen = true)} aria-label="Info">i</button>
	{/if}
</div>

<style>
	.map-wrap {
		position: relative;
		height: calc(100vh - 48px);
		height: calc(100vh - 48px - env(safe-area-inset-top, 0px));
		height: calc(100dvh - 48px - env(safe-area-inset-top, 0px));
	}

	#map {
		height: 100%;
		width: 100%;
	}

	:global(.travel-icon) {
		background: none;
		border: none;
	}

	:global(.se-icon) {
		background: none;
		border: none;
	}

	:global(.travel-icon .ti) {
		display: block;
		font-size: 30px;
		line-height: 36px;
		text-align: center;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
		animation: travelbob 2.2s ease-in-out infinite;
	}

	@keyframes travelbob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-3px);
		}
	}

	.spinner {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: #fafafa;
		z-index: 1000;
		color: #888;
		font-size: 1.4rem;
	}

	.panel {
		position: absolute;
		top: 16px;
		left: 16px;
		z-index: 1000;
		background: #fffdf6;
		border: 2px solid #a08d6e;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		padding: 16px 18px;
		box-shadow: 0 4px 18px rgba(80, 62, 30, 0.22);
		max-width: 280px;
		transition: opacity 0.2s;
	}

	.panel.hidden {
		opacity: 0;
		pointer-events: none;
	}

	.panel h1 {
		margin: 0 0 2px;
		font-family: 'Caveat', cursive;
		font-weight: 500;
		font-size: 1.9rem;
		line-height: 1.1;
		color: #3b3126;
	}

	.panel p {
		margin: 0 0 10px;
		color: #6b5f4a;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.panel .counts {
		display: flex;
		gap: 16px;
		font-size: 0.85rem;
		color: #3b3126;
		font-weight: 600;
	}

	.close {
		position: absolute;
		top: 6px;
		right: 10px;
		border: none;
		background: transparent;
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
		color: #6b5f4a;
	}

	.reopen {
		position: absolute;
		top: 16px;
		left: 16px;
		z-index: 1000;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: #fffdf6;
		box-shadow: 0 2px 10px rgba(80, 62, 30, 0.2);
		font-style: italic;
		font-weight: 700;
		cursor: pointer;
		color: #3b3126;
	}

	.sim {
		position: absolute;
		bottom: calc(16px + env(safe-area-inset-bottom, 0px));
		left: 16px;
		transform: none;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: #fffdf6;
		border: 2px solid #a08d6e;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		padding: 8px 14px;
		box-shadow: 0 4px 18px rgba(80, 62, 30, 0.22);
		width: min(460px, calc(100vw - 32px));
	}

	.sim-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.sim-date {
		font-family: 'Short Stack', cursive;
		font-size: 0.85rem;
		color: #3b3126;
		white-space: nowrap;
		width: 15em;
		text-align: left;
	}

	.sim-ctls {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.sim-ctl-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 2px solid #a08d6e;
		background: transparent;
		color: #6b5f4a;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		min-width: 30px;
		height: 24px;
		padding: 0 8px;
		font-size: 0.8rem;
		line-height: 1;
		font-family: 'Short Stack', cursive;
		cursor: pointer;
		touch-action: manipulation;
		white-space: nowrap;
	}

	.sim-ctl-btn:active {
		background: #e8a33d;
		color: #2c2417;
		border-color: #e8a33d;
	}

	.journey {
		display: block;
	}

	.journey-track {
		position: relative;
		height: 24px;
		touch-action: none;
		cursor: pointer;
		outline: none;
	}

	.journey-track:focus-visible {
		border-radius: 6px;
		box-shadow: 0 0 0 2px #b4552d;
	}

	.journey-line {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		left: 0;
		right: 0;
		height: 4px;
		border-radius: 2px;
		background: #e2d7bd;
	}

	.journey-tick {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 9px;
		height: 9px;
		padding: 0;
		border-radius: 50%;
		border: 1.5px solid #cbb89a;
		background: #fffdf6;
		pointer-events: none;
	}

	.journey-tick.done {
		background: #d9cbb0;
		border-color: #d9cbb0;
	}

	.journey-tick.active {
		background: #e8a33d;
		border-color: #3b3126;
		width: 11px;
		height: 11px;
	}

	:global(.leaflet-popup-content-wrapper) {
		background: #fffdf6;
		border: 2px solid #a08d6e;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		box-shadow: 0 4px 18px rgba(80, 62, 30, 0.25);
	}

	:global(.leaflet-popup-tip) {
		background: #fffdf6;
		border: 2px solid #a08d6e;
	}

	:global(.leaflet-popup-content) {
		margin: 12px;
		line-height: 1.35;
		font-family: 'Lora', Georgia, serif;
		color: #3b3126;
	}

	:global(.pp) {
		display: block;
		text-decoration: none;
	}

	:global(.pp img) {
		display: block;
		width: 280px;
		max-width: 70vw;
		height: 200px;
		object-fit: cover;
		border-radius: 3px;
		border: 1px solid #e2d7bd;
		margin-bottom: 6px;
	}

	@media (max-width: 640px) {
		.panel {
			left: 12px;
			right: 12px;
			top: 12px;
			max-width: none;
		}

		.sim {
			width: calc(100vw - 88px);
			padding: 7px 10px;
			gap: 6px;
		}

		.sim-top {
			gap: 6px;
		}

		.sim-date {
			font-size: 0.72rem;
		}

		.journey-tick {
			width: 8px;
			height: 8px;
		}

		.journey-tick.active {
			width: 10px;
			height: 10px;
		}

		.reopen {
			left: 12px;
			top: 12px;
		}

		:global(.pp img) {
			max-width: 82vw;
			width: auto;
		}
	}

	:global(.pc) {
		font-family: 'Caveat', cursive;
		font-weight: 500;
		font-size: 1.2rem;
		line-height: 1.1;
	}

	:global(.pd) {
		color: #6b5f4a;
		font-size: 0.8rem;
		margin-top: 2px;
	}
</style>
