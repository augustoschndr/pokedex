/* Runs before paint. Keep in step with src/lib/theme.ts. */
(function () {
	var choice = 'system';
	var match = document.cookie.match(/(?:^|; )pokedex-theme=([^;]*)/);
	if (match) choice = decodeURIComponent(match[1]);
	else {
		try {
			choice = localStorage.getItem('pokedex-theme') || 'system';
		} catch (e) {
			choice = 'system';
		}
	}
	if (choice !== 'light' && choice !== 'dark' && choice !== 'system') choice = 'system';
	var dark =
		choice === 'dark' ||
		(choice !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	var root = document.documentElement;
	root.dataset.theme = dark ? 'dark' : 'light';
	root.style.colorScheme = dark ? 'dark' : 'light';
	var color = dark ? '#1C1916' : '#FBF7F3';
	var theme = document.querySelector('meta[name="theme-color"]');
	if (theme) theme.setAttribute('content', color);
	var scheme = document.querySelector('meta[name="color-scheme"]');
	if (scheme) scheme.setAttribute('content', dark ? 'dark' : 'light');
})();
