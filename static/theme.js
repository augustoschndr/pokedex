/* Same first-paint steps as the inline script in src/app.html. This file is not loaded. */
(function () {
	var stored = null;
	try {
		stored = localStorage.getItem('pokedex-theme');
	} catch (e) {
		stored = null;
	}
	var fromCookie = '';
	var match = document.cookie.match(/(?:^|; )pokedex-theme=([^;]*)/);
	if (match) {
		try {
			fromCookie = decodeURIComponent(match[1]);
		} catch (e) {
			fromCookie = '';
		}
	}
	function ok(value) {
		return value === 'light' || value === 'dark' || value === 'system';
	}
	var choice = 'system';
	if (ok(fromCookie) && fromCookie !== 'system') choice = fromCookie;
	else if (ok(stored)) choice = stored;
	else if (ok(fromCookie)) choice = fromCookie;
	var dark = choice === 'dark' || (choice !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	try {
		if (stored !== choice) localStorage.setItem('pokedex-theme', choice);
	} catch (e) {
		/* private mode */
	}
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
