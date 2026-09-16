/** Client-side Palantir event. No-op during SSR or before `/palantir.js` has run. */
export const track = (name: string, properties: Record<string, unknown> = {}) => {
	if (typeof window === 'undefined') return;
	window.palantir?.capture(name, properties);
};
