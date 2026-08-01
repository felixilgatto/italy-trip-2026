<script>
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import { stops, route } from '$lib/data/stops.js';
	import { lang, dict } from '$lib/i18n/index.js';
	import { page } from '$app/state';

	let L;
	let map;
	let layerGroup;
	let photoMarkers = [];
	let travelMarker;
	let travelIcons;
	let rafId;
	let curSeg = -1;
	let frac = 0;
	let lastNow = 0;
	const SPEED_PX = 55;
	let photos = $state([]);
	let loading = $state(true);
	let panelOpen = $state(true);

	const orderedStops = [stops[0], stops[1], stops[2], stops[3], stops[1], stops[0]];
	const segModes = orderedStops.slice(0, -1).map((s, i) => {
		const dst = orderedStops[i + 1];
		if ([s.id, dst.id].sort().join('-') === 'milan-paris') return 'highspeed';
		const t = `${dst.transport.en} ${dst.transport.fr}`.toLowerCase();
		return /ferry|boat|bateau/.test(t) ? 'boat' : 'train';
	});

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

		L.control.zoom({ position: 'bottomright' }).addTo(map);

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

		travelIcons = {
			highspeed: L.divIcon({
				className: 'travel-icon',
				html: '<span class="ti">🚄</span>',
				iconSize: [36, 36],
				iconAnchor: [18, 18]
			}),
			train: L.divIcon({
				className: 'travel-icon',
				html: '<span class="ti">🚆</span>',
				iconSize: [36, 36],
				iconAnchor: [18, 18]
			}),
			boat: L.divIcon({
				className: 'travel-icon',
				html: '<span class="ti">⛴️</span>',
				iconSize: [36, 36],
				iconAnchor: [18, 18]
			})
		};

		travelMarker = L.marker([0, 0], {
			icon: travelIcons.train,
			interactive: false,
			zIndexOffset: 500
		}).addTo(map);
		rafId = requestAnimationFrame(tick);

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

	function pointAtProgress(pts, t, zoom) {
		const lens = [];
		let total = 0;
		for (let i = 0; i < pts.length - 1; i++) {
			const d = pts[i].distanceTo(pts[i + 1]);
			lens.push(d);
			total += d;
		}
		if (!total) return { latlng: pts[0], seg: 0 };
		let target = ((t % 1) + 1) % 1 * total;
		for (let i = 0; i < lens.length; i++) {
			if (target <= lens[i] || i === lens.length - 1) {
				const f = lens[i] === 0 ? 0 : target / lens[i];
				const p = pts[i].multiplyBy(1 - f).add(pts[i + 1].multiplyBy(f));
				return { latlng: map.unproject(p, zoom), seg: i };
			}
			target -= lens[i];
		}
		return { latlng: pts[pts.length - 1], seg: lens.length - 1 };
	}

	function tick(now) {
		if (!map || !travelMarker) return;
		if (!lastNow) lastNow = now;
		const dt = Math.min((now - lastNow) / 1000, 0.1);
		lastNow = now;
		const zoom = map.getZoom();
		const pts = route.map(([lat, lng]) => map.project([lat, lng], zoom));
		let total = 0;
		for (let i = 0; i < pts.length - 1; i++) total += pts[i].distanceTo(pts[i + 1]);
		if (total > 0) frac = (frac + (SPEED_PX * dt) / total) % 1;
		const { latlng, seg } = pointAtProgress(pts, frac, zoom);
		travelMarker.setLatLng(latlng);
		if (seg !== curSeg) {
			curSeg = seg;
			travelMarker.setIcon(travelIcons[segModes[seg] || 'train']);
		}
		rafId = requestAnimationFrame(tick);
	}

	function redraw() {
		layerGroup.clearLayers();
		photoMarkers = [];

		for (const s of stops) {
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

	<div class="panel" class:hidden={!panelOpen}>
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
		height: calc(100dvh - 48px);
		height: calc(100vh - 48px);
	}

	#map {
		height: 100%;
		width: 100%;
	}

	:global(.travel-icon) {
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
