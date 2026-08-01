import { writable, derived } from 'svelte/store';
import en from './en.js';
import fr from './fr.js';

export const dicts = { en, fr };

export const lang = writable('fr');
export const dict = derived(lang, ($lang) => dicts[$lang] || en);

export function setLang(l) {
	if (dicts[l]) lang.set(l);
}
