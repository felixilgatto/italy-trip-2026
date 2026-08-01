import { stops } from './stops.js';

/**
 * Itinerary for the map animation, derived from docs/planning.csv.
 * Times come from the "Durée / Descriptif" column of each travel/hotel row.
 */

/** Animation seconds per real day at 1× (so 1 real hour = 1 animation second). */
export const BASE_SCALE = 24;

/** Multipliers available in the map speed control. */
export const SPEED_OPTIONS = [1, 2, 4, 8];

/** Starting multiplier — 4× makes the full loop ≈ 1 min 44 s. */
export const DEFAULT_SPEED = 4;

const iso = (t) => new Date(t);

/** Ordered list of legs covering the whole trip, start to finish. */
export const legs = [
	{ type: 'travel', from: 'paris', to: 'milan', mode: 'highspeed', icon: '🚄', start: iso('2026-08-13T06:46'), end: iso('2026-08-13T13:53') },
	{ type: 'stay', at: 'milan', icon: '🏠', start: iso('2026-08-13T13:53'), end: iso('2026-08-16T20:53') },
	{ type: 'travel', from: 'milan', to: 'naples', mode: 'train', icon: '🚆', start: iso('2026-08-16T20:53'), end: iso('2026-08-17T08:46') },
	{ type: 'stay', at: 'naples', icon: '🏠', start: iso('2026-08-17T08:46'), end: iso('2026-08-19T20:00') },
	{ type: 'travel', from: 'naples', to: 'palermo', mode: 'boat', icon: '⛴️', start: iso('2026-08-19T20:00'), end: iso('2026-08-20T07:00') },
	{ type: 'stay', at: 'palermo', icon: '🏠', start: iso('2026-08-20T07:00'), end: iso('2026-08-28T12:53') },
	{ type: 'travel', from: 'palermo', to: 'milan', mode: 'train', icon: '🚆', start: iso('2026-08-28T12:53'), end: iso('2026-08-29T11:55') },
	{ type: 'stay', at: 'milan', icon: '🏠', start: iso('2026-08-29T11:55'), end: iso('2026-08-30T06:00') },
	{ type: 'travel', from: 'milan', to: 'paris', mode: 'highspeed', icon: '🚄', start: iso('2026-08-30T06:00'), end: iso('2026-08-30T13:18') }
];

export const totalMs = legs[legs.length - 1].end - legs[0].start;

/** Timestamp (ms) of the start of the trip. */
export const startMs = legs[0].start.getTime();

/** Progress fraction at the start of each leg (for discrete slider jumps). */
export const legStartFrac = (() => {
	const out = [];
	let acc = 0;
	for (const l of legs) {
		out.push(acc / totalMs);
		acc += l.end - l.start;
	}
	return out;
})();

const stop = (id) => stops.find((s) => s.id === id);

/** Emoji cycle shown while parked in a city, keyed by hour of day. */
export const ACTIVITIES = [
	{ from: 0, icon: '😴' },
	{ from: 6, icon: '☕' },
	{ from: 8, icon: '🚶' },
	{ from: 12, icon: '🍕' },
	{ from: 14, icon: '🚶' },
	{ from: 18, icon: '🌇' },
	{ from: 20, icon: '🍻' },
	{ from: 23, icon: '😴' }
];

function activityIcon(date) {
	let icon = ACTIVITIES[0].icon;
	for (const a of ACTIVITIES) {
		if (date.getHours() >= a.from) icon = a.icon;
	}
	return icon;
}

const TRAVEL_ICONS = { highspeed: '🚄', train: '🚆', boat: '⛴️' };

/**
 * Total animation seconds for one full loop at a given speed multiplier.
 * At 1×: totalMs → real hours worth of seconds (1h = 1s).
 */
export function animationSecondsAt(speed) {
	return ((totalMs / 1000) * (BASE_SCALE / (24 * 3600))) / speed;
}

/**
 * Resolve a position on the itinerary for a progress fraction in [0, 1).
 * Returns the marker coordinates, the emoji to display, and the simulated date.
 */
export function resolveAt(frac) {
	const offset = frac >= 1 ? totalMs : (((frac % 1) + 1) % 1) * totalMs;

	let acc = 0;
	let leg = legs[0];
	let legIndex = 0;
	for (let i = 0; i < legs.length; i++) {
		const l = legs[i];
		if (offset <= acc + (l.end - l.start)) {
			leg = l;
			legIndex = i;
			break;
		}
		acc += l.end - l.start;
	}

	const date = new Date(legs[0].start.getTime() + offset);
	let lat;
	let lng;
	let icon;

	if (leg.type === 'travel') {
		const a = stop(leg.from);
		const b = stop(leg.to);
		const t = Math.max(0, Math.min(1, (offset - acc) / (leg.end - leg.start)));
		lat = a.lat + (b.lat - a.lat) * t;
		lng = a.lng + (b.lng - a.lng) * t;
		icon = leg.icon || TRAVEL_ICONS[leg.mode] || '🚆';
	} else {
		const s = stop(leg.at);
		lat = s.lat;
		lng = s.lng;
		icon = activityIcon(date);
	}

	return { lat, lng, icon, date, legIndex };
}
