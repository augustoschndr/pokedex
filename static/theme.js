/* Same first-paint steps as the inline script in src/app.html. This file is not
   loaded. The inline copy is what runs, so a network fetch cannot delay the splash. */
(function () {
	var choice = 'system';
	try {
		var saved = localStorage.getItem('pokedex-theme');
		if (saved === 'light' || saved === 'dark' || saved === 'system') choice = saved;
	} catch (e) {
		choice = 'system';
	}
	var dark = choice === 'dark' || (choice !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	var root = document.documentElement;
	var bg = dark ? '#1C1916' : '#FBF7F3';
	var ink = dark ? '#F6F1EA' : '#171513';
	root.dataset.theme = dark ? 'dark' : 'light';
	root.style.colorScheme = dark ? 'dark' : 'light';
	root.style.background = bg;
	root.style.color = ink;
	var theme = document.querySelector('meta[name="theme-color"]');
	if (theme) theme.setAttribute('content', bg);
	var scheme = document.querySelector('meta[name="color-scheme"]');
	if (scheme) scheme.setAttribute('content', dark ? 'dark' : 'light');
})();
