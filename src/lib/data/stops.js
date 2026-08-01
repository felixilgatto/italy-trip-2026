export const stops = [
	{
		id: 'paris',
		name: { en: 'Paris', fr: 'Paris' },
		lat: 48.8447,
		lng: 2.3736,
		dates: { en: 'Aug 13 & 30', fr: '13 & 30 août' },
		transport: { en: 'TGV', fr: 'TGV' },
		note: { en: 'Start & return — Gare de Lyon', fr: 'Départ & retour — Gare de Lyon' }
	},
	{
		id: 'milan',
		name: { en: 'Milan', fr: 'Milan' },
		lat: 45.4843,
		lng: 9.1872,
		dates: { en: 'Aug 13–16 & 29–30', fr: '13–16 & 29–30 août' },
		transport: { en: 'TGV · Night train', fr: 'TGV · train de nuit' },
		note: { en: 'Ostello Bello Duomo & Grande', fr: 'Ostello Bello Duomo & Grande' }
	},
	{
		id: 'naples',
		name: { en: 'Naples', fr: 'Naples' },
		lat: 40.8522,
		lng: 14.2681,
		dates: { en: 'Aug 17–19', fr: '17–19 août' },
		transport: { en: 'Night train', fr: 'Train de nuit' },
		note: { en: 'Historic center', fr: 'Centre historique' }
	},
	{
		id: 'palermo',
		name: { en: 'Palermo', fr: 'Palerme' },
		lat: 38.1157,
		lng: 13.3615,
		dates: { en: 'Aug 20–28', fr: '20–28 août' },
		transport: { en: 'Night ferry', fr: 'Ferry de nuit' },
		note: { en: 'Ostello Bello Palermo', fr: 'Ostello Bello Palermo' }
	}
];

export const route = [stops[0], stops[1], stops[2], stops[3], stops[1], stops[0]].map((s) => [
	s.lat,
	s.lng
]);
