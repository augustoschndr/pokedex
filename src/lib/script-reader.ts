import { writable } from 'svelte/store';

export const scriptReader = writable<{ title: string; text: string } | null>(null);
