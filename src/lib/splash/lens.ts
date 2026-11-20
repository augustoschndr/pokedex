export function canUseWebGL(): boolean {
	try {
		const canvas = document.createElement('canvas');
		return Boolean(canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }));
	} catch {
		return false;
	}
}

/** A slow wireframe lens. The import of three stays inside this module. */
export async function mountLens(canvas: HTMLCanvasElement, hold: boolean): Promise<() => void> {
	const {
		WebGLRenderer,
		Scene,
		PerspectiveCamera,
		Group,
		BufferGeometry,
		Float32BufferAttribute,
		LineBasicMaterial,
		LineLoop
	} = await import('three');

	const renderer = new WebGLRenderer({
		canvas,
		alpha: true,
		antialias: true,
		powerPreference: 'low-power',
		failIfMajorPerformanceCaveat: false
	});
	renderer.setClearColor(0x000000, 0);
	const scene = new Scene();
	const camera = new PerspectiveCamera(32, 1, 0.1, 20);
	camera.position.z = 5.4;
	const group = new Group();
	scene.add(group);

	const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#171513';
	const material = new LineBasicMaterial({ color: ink, transparent: true, opacity: 0.7 });
	const geometries: InstanceType<typeof BufferGeometry>[] = [];

	function ring(radius: number, tilt: [number, number, number]) {
		const segments = 72;
		const positions: number[] = [];
		for (let i = 0; i < segments; i++) {
			const angle = (i / segments) * Math.PI * 2;
			positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
		const loop = new LineLoop(geometry, material);
		loop.rotation.set(...tilt);
		group.add(loop);
		geometries.push(geometry);
	}

	ring(1.12, [0.42, 0.18, 0]);
	ring(1.28, [1.12, 0.12, 0.18]);
	ring(1.02, [0.16, 1.02, 0.35]);

	const resize = () => {
		const width = canvas.clientWidth || 240;
		const height = canvas.clientHeight || 240;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setSize(width, height, false);
		camera.aspect = width / Math.max(1, height);
		camera.updateProjectionMatrix();
	};
	resize();

	let frame = 0;
	let stopped = false;
	let sized = false;
	const started = performance.now();
	const draw = (now: number) => {
		if (stopped) return;
		if (!sized && canvas.clientWidth > 0) {
			resize();
			sized = true;
		}
		const elapsed = hold ? 860 : now - started;
		group.rotation.y = elapsed * 0.00045;
		group.rotation.x = Math.sin(elapsed * 0.00028) * 0.16;
		renderer.render(scene, camera);
		canvas.dataset.ready = '1';
		frame = requestAnimationFrame(draw);
	};
	frame = requestAnimationFrame(draw);
	window.addEventListener('resize', resize);

	return () => {
		stopped = true;
		cancelAnimationFrame(frame);
		window.removeEventListener('resize', resize);
		for (const geometry of geometries) geometry.dispose();
		material.dispose();
		renderer.dispose();
	};
}
