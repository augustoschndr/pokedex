/** A check reacts on pointerdown. The click that follows that press is ignored. */
let pointerAt = 0;

export function takeCheckPress(event: Event): boolean {
	if (event.type === 'pointerdown') {
		const pointer = event as PointerEvent;
		if (pointer.button !== 0) return false;
		pointer.preventDefault();
		pointer.stopPropagation();
		pointerAt = performance.now();
		return true;
	}
	if (event.type === 'click') {
		event.stopPropagation();
		if (performance.now() - pointerAt < 700) return false;
		return true;
	}
	return false;
}
