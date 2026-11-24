<script lang="ts">
	import { onMount } from 'svelte';
	import {
		SPEED_KEY,
		cameraErrorMessage,
		clampSpeed,
		formatClock,
		micErrorMessage,
		shareRecording,
		supportedRecorderMimes,
		takeFromChunks
	} from '$lib/prompter';

	let { title, text, onclose }: { title: string; text: string; onclose: () => void } = $props();

	const sizes = [28, 34, 40, 48, 56];

	let scroller = $state<HTMLDivElement | null>(null);
	let videoEl = $state<HTMLVideoElement | null>(null);
	let speed = $state(48);
	let sizeIndex = $state(2);
	let mirror = $state(false);
	let phase = $state<'count' | 'play' | 'pause'>('count');
	let count = $state(3);
	let cameraOn = $state(false);
	let cameraReady = $state(false);
	let cameraError = $state('');
	let recordError = $state('');
	let recording = $state(false);
	let recordMs = $state(0);
	let savedUrl = $state<string | null>(null);
	let savedName = $state('');
	let saveOffer = $state(false);
	let saveError = $state('');
	let stream = $state<MediaStream | null>(null);

	let countTimer = 0;
	let recorder: MediaRecorder | null = null;
	let audioStream: MediaStream | null = null;
	let savedFile: File | null = null;
	let chunks: Blob[] = [];
	let chosenMime = '';
	let arming = false;
	let disposed = false;
	let tapX = 0;
	let tapY = 0;

	const size = $derived(sizes[sizeIndex]);
	const playing = $derived(phase === 'play');

	function beginCountdown() {
		window.clearTimeout(countTimer);
		phase = 'count';
		count = 3;
		const tick = () => {
			if (disposed) return;
			if (count <= 1) {
				phase = 'play';
				return;
			}
			count -= 1;
			countTimer = window.setTimeout(tick, 1000);
		};
		countTimer = window.setTimeout(tick, 1000);
	}

	function togglePlay() {
		if (phase === 'count') {
			window.clearTimeout(countTimer);
			phase = 'pause';
			return;
		}
		phase = phase === 'play' ? 'pause' : 'play';
	}

	function restart() {
		if (scroller) scroller.scrollTop = 0;
		beginCountdown();
	}

	function setSpeed(next: number) {
		speed = clampSpeed(next);
		try {
			localStorage.setItem(SPEED_KEY, String(speed));
		} catch {
			/* private mode */
		}
	}

	function onScriptDown(event: PointerEvent) {
		tapX = event.clientX;
		tapY = event.clientY;
	}

	function onScriptTap(event: MouseEvent) {
		if (Math.hypot(event.clientX - tapX, event.clientY - tapY) > 8) return;
		togglePlay();
	}

	function stopAudio() {
		for (const track of audioStream?.getTracks() ?? []) track.stop();
		audioStream = null;
	}

	function stopVideo() {
		for (const track of stream?.getTracks() ?? []) track.stop();
		stream = null;
		cameraReady = false;
	}

	function errorText(error: unknown, fallback: string): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		if (error instanceof Error && error.message) return error.message;
		return fallback;
	}

	function releaseUrl() {
		if (savedUrl) URL.revokeObjectURL(savedUrl);
		savedUrl = null;
		savedFile = null;
		savedName = '';
	}

	function discardTake() {
		releaseUrl();
		saveOffer = false;
		saveError = '';
	}

	function holdTake(file: File) {
		releaseUrl();
		savedFile = file;
		savedName = file.name;
		savedUrl = URL.createObjectURL(file);
	}

	function finishTake() {
		// Draw the sheet before stop. Asking iOS to flush first can swallow the stop event.
		saveError = '';
		saveOffer = true;
		const active = recorder;
		recorder = null;
		recording = false;
		if (!active || active.state === 'inactive') {
			stopAudio();
			if (!savedFile) saveError = 'This take was not recorded.';
			return;
		}
		try {
			active.stop();
		} catch (error) {
			stopAudio();
			saveError = errorText(error, 'The recording could not stop.');
			return;
		}
		try {
			const file = takeFromChunks(chunks, active.mimeType || chosenMime || 'video/mp4');
			if (file) holdTake(file);
		} catch (error) {
			saveError = errorText(error, 'The recording could not be saved.');
		}
	}

	function stopRecorder(keepTake: boolean) {
		if (keepTake) {
			finishTake();
			return;
		}
		const active = recorder;
		recorder = null;
		chunks = [];
		recording = false;
		if (!active || active.state === 'inactive') {
			stopAudio();
			return;
		}
		active.ondataavailable = null;
		active.onstop = () => stopAudio();
		try {
			active.stop();
		} catch {
			stopAudio();
		}
	}

	function cleanup() {
		if (disposed) return;
		disposed = true;
		window.clearTimeout(countTimer);
		stopRecorder(false);
		stopVideo();
		discardTake();
	}

	async function toggleCamera() {
		recordError = '';
		if (cameraOn) {
			stopRecorder(false);
			stopVideo();
			cameraOn = false;
			cameraError = '';
			return;
		}
		cameraOn = true;
		cameraError = '';
		cameraReady = false;
		if (!navigator.mediaDevices?.getUserMedia) {
			cameraError = 'This browser cannot open the camera.';
			return;
		}
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'user' },
				audio: false
			});
		} catch (error) {
			const name = error instanceof DOMException ? error.name : '';
			cameraError = cameraErrorMessage(name);
			stream = null;
		}
	}

	async function toggleRecord() {
		if (recording) {
			stopRecorder(true);
			return;
		}
		if (arming || !stream) return;
		recordError = '';
		if (typeof MediaRecorder === 'undefined') {
			recordError = 'This browser cannot record video.';
			return;
		}
		arming = true;
		try {
			const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mixed = new MediaStream([...stream.getVideoTracks(), ...audio.getAudioTracks()]);
			let supported: (type: string) => boolean = () => false;
			try {
				supported = (type) => MediaRecorder.isTypeSupported(type);
			} catch {
				supported = () => false;
			}
			const attempts = supportedRecorderMimes(supported);
			const list = attempts.length ? attempts : [''];
			let rec: MediaRecorder | null = null;
			let lastError: unknown;
			for (const mime of list) {
				try {
					rec = mime ? new MediaRecorder(mixed, { mimeType: mime }) : new MediaRecorder(mixed);
					chosenMime = rec.mimeType || mime || 'video/mp4';
					break;
				} catch (error) {
					lastError = error;
					rec = null;
				}
			}
			if (!rec) {
				for (const track of audio.getTracks()) track.stop();
				recordError = errorText(lastError, 'This browser cannot record video.');
				return;
			}
			chunks = [];
			rec.ondataavailable = (event) => {
				try {
					if (event.data.size > 0) chunks.push(event.data);
				} catch (error) {
					saveOffer = true;
					saveError = errorText(error, 'The recording could not be saved.');
				}
			};
			rec.onstop = () => {
				try {
					stopAudio();
					if (disposed) return;
					recording = false;
					saveOffer = true;
					const file = takeFromChunks(chunks, rec.mimeType || chosenMime || 'video/mp4');
					if (!file) {
						if (!savedFile) saveError = 'The recording was empty.';
						return;
					}
					holdTake(file);
					saveError = '';
				} catch (error) {
					saveOffer = true;
					saveError = errorText(error, 'The recording could not be saved.');
				}
			};
			rec.start(500);
			recorder = rec;
			audioStream = audio;
			recording = true;
			recordMs = 0;
		} catch (error) {
			const name = error instanceof DOMException ? error.name : '';
			recordError = micErrorMessage(name);
		} finally {
			arming = false;
		}
	}

	function releaseTake() {
		discardTake();
	}

	function saveToPhotos() {
		const file = savedFile;
		if (!file) {
			saveError = 'The video is not ready yet.';
			return;
		}
		const share = navigator.share;
		if (typeof share !== 'function') {
			saveError = 'This browser has no share sheet. Use Download.';
			return;
		}
		saveError = '';
		try {
			void shareRecording(
				file,
				(data) => share.call(navigator, data),
				(data) => (typeof navigator.canShare === 'function' ? navigator.canShare(data) : true)
			).then((outcome) => {
				if (disposed || savedFile !== file) return;
				if (outcome === 'shared') releaseTake();
				else if (outcome === 'button') saveError = 'Photos cannot take this video. Use Download.';
			});
		} catch (error) {
			saveError = errorText(error, 'The share sheet did not open.');
		}
	}

	function retake() {
		releaseTake();
		if (cameraOn && stream) void toggleRecord();
	}

	function close() {
		cleanup();
		onclose();
	}

	onMount(() => {
		try {
			speed = clampSpeed(localStorage.getItem(SPEED_KEY));
		} catch {
			/* private mode */
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close();
		};
		window.addEventListener('keydown', onKey);
		beginCountdown();
		return () => {
			window.removeEventListener('keydown', onKey);
			cleanup();
		};
	});

	$effect(() => {
		const node = scroller;
		if (!node) return;
		node.addEventListener('pointerdown', onScriptDown);
		node.addEventListener('click', onScriptTap);
		return () => {
			node.removeEventListener('pointerdown', onScriptDown);
			node.removeEventListener('click', onScriptTap);
		};
	});

	$effect(() => {
		const node = scroller;
		const px = speed;
		if (!node || phase !== 'play' || px <= 0) return;
		let frame = 0;
		let last = performance.now();
		const step = (now: number) => {
			const dt = Math.min(now - last, 48);
			last = now;
			node.scrollTop += (px * dt) / 1000;
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		if (!playing && !recording) return;
		if (!('wakeLock' in navigator)) return;
		let sentinel: WakeLockSentinel | null = null;
		let cancelled = false;
		const arm = () => {
			if (cancelled || document.visibilityState === 'hidden') return;
			navigator.wakeLock
				.request('screen')
				.then((next) => {
					if (cancelled) void next.release().catch(() => undefined);
					else sentinel = next;
				})
				.catch(() => undefined);
		};
		arm();
		document.addEventListener('visibilitychange', arm);
		return () => {
			cancelled = true;
			document.removeEventListener('visibilitychange', arm);
			void sentinel?.release().catch(() => undefined);
		};
	});

	$effect(() => {
		const node = videoEl;
		const media = stream;
		if (!node) return;
		node.srcObject = media;
		if (!media) return;
		void node.play().catch(() => undefined);
	});

	$effect(() => {
		if (!recording) return;
		const started = performance.now();
		let frame = 0;
		const step = (now: number) => {
			recordMs = now - started;
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class="prompter" class:camera={cameraOn} class:is-mirror={mirror} role="dialog" aria-modal="true" aria-label="Script">
	{#if cameraOn}
		<div class="prompter-placeholder" aria-hidden="true"><span></span></div>
		{#if stream}
			<video
				class="prompter-camera"
				class:is-ready={cameraReady}
				autoplay
				playsinline
				muted
				bind:this={videoEl}
				onloadeddata={() => (cameraReady = true)}
			></video>
		{/if}
		<div class="prompter-scrim"></div>
	{/if}

	<div class="prompter-stage">
		<div class="prompter-guide" aria-hidden="true"></div>
		<div class="prompter-scroll" bind:this={scroller}>
			<div class="prompter-lead"></div>
			<div class="prompter-pad">
				<p class="kicker">{title}</p>
				<p class="prompter-text" style:font-size="{size}px">{text}</p>
			</div>
			<div class="prompter-tail"></div>
		</div>
		{#if phase === 'count'}
			<div class="prompter-count" aria-live="polite">
				{#key count}<b>{count}</b>{/key}
			</div>
		{/if}
	</div>

	{#if cameraError}<p class="prompter-camera-note" role="alert">{cameraError}</p>{/if}
	{#if recordError}<p class="prompter-note" role="alert">{recordError}</p>{/if}
	{#if saveOffer}
		<div class="prompter-save" role="status">
			<p>Tap Save Video to put it in Photos</p>
			{#if saveError}<p class="prompter-note" role="alert">{saveError}</p>{/if}
			<button class="pill" type="button" onclick={saveToPhotos}>Save to Photos</button>
			{#if savedUrl}<a class="prompter-download" href={savedUrl} download={savedName}>Download</a>{/if}
			<div class="prompter-save-actions">
				<button class="text-btn" type="button" onclick={retake}>Retake</button>
				<button class="text-btn" type="button" onclick={releaseTake}>Discard</button>
			</div>
		</div>
	{/if}

	<div class="prompter-bar">
		<div class="prompter-row">
			<button class="text-btn" type="button" onclick={close}>Close</button>
			<button class="prompter-icon" type="button" aria-label={phase === 'pause' ? 'Play' : 'Pause'} onclick={togglePlay}>
				{#if phase === 'pause'}
					<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
						<path d="M6 4.5v9l8-4.5-8-4.5z" fill="currentColor" />
					</svg>
				{:else}
					<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
						<path d="M5.5 4h2.2v10H5.5zM10.3 4h2.2v10h-2.2z" fill="currentColor" />
					</svg>
				{/if}
			</button>
			<button class="prompter-icon" type="button" aria-label="Restart" onclick={restart}>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
					<path d="M4 9a5 5 0 1 0 1.2-3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
					<path d="M4 3.5V6.2h2.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
			<span class="prompter-spacer"></span>
			<button
				class="prompter-icon"
				type="button"
				aria-pressed={cameraOn}
				aria-label={cameraOn ? 'Hide camera' : 'Show camera'}
				onclick={toggleCamera}
			>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
					<rect x="2.5" y="5" width="15" height="11" rx="2.5" stroke="currentColor" stroke-width="1.5" />
					<circle cx="10" cy="10.5" r="2.6" stroke="currentColor" stroke-width="1.5" />
				</svg>
			</button>
			<button
				class="prompter-icon"
				class:is-rec={recording}
				type="button"
				aria-pressed={recording}
				aria-label={recording ? `Stop recording, ${formatClock(recordMs)}` : 'Record'}
				disabled={!stream}
				onclick={toggleRecord}
			>
				{#if recording}
					<span class="rec-dot" aria-hidden="true"></span>
					<span class="rec-time">{formatClock(recordMs)}</span>
				{:else}
					<span class="rec-idle" aria-hidden="true"></span>
				{/if}
			</button>
		</div>
		<div class="prompter-row">
			<button class="prompter-icon prompter-size" type="button" aria-label="Smaller text" disabled={sizeIndex === 0} onclick={() => sizeIndex--}>A−</button>
			<button class="prompter-icon prompter-size" type="button" aria-label="Larger text" disabled={sizeIndex === sizes.length - 1} onclick={() => sizeIndex++}>A+</button>
			<button class="prompter-icon" type="button" aria-pressed={mirror} aria-label="Mirror text" onclick={() => (mirror = !mirror)}>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
					<path d="M9 3v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
					<path d="M7 5.5H4.5v7H7M11 5.5h2.5v7H11" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
				</svg>
			</button>
			<label class="prompter-speed">
				<span class="visually-hidden">Scroll speed</span>
				<input
					type="range"
					min="16"
					max="120"
					step="1"
					value={speed}
					aria-valuemin="16"
					aria-valuemax="120"
					aria-valuenow={speed}
					aria-label="Scroll speed"
					oninput={(event) => setSpeed(Number(event.currentTarget.value))}
				/>
			</label>
		</div>
	</div>
</div>
