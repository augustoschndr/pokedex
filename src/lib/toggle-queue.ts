/** One server toggle per tap, in order. A failure drops the rest of the burst. */
export function createToggleQueue(handlers: {
	onFail: () => void;
	onIdle: () => Promise<void> | void;
}): (post: () => Promise<boolean>) => void {
	let tail = Promise.resolve();
	let generation = 0;

	return (post) => {
		const gen = generation;
		const run = tail.then(async () => {
			if (gen !== generation) return;
			let ok = false;
			try {
				ok = await post();
			} catch {
				ok = false;
			}
			if (gen !== generation) return;
			if (!ok) {
				generation += 1;
				handlers.onFail();
			}
		});
		const settled = run.then(
			() => undefined,
			() => undefined
		);
		tail = settled;
		void run.then(async () => {
			if (gen !== generation || tail !== settled) return;
			await handlers.onIdle();
		});
	};
}
