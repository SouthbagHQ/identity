// AEST clock for the security questions. Ported from Southbag Git (src/lib/hours.ts): Southbag
// does not observe daylight saving, so AEST is UTC+10 all year.

const OFFSET = 10 * 3600000;

/** Hour (0-23) and weekday (0 = Sunday) in AEST for a unix-seconds timestamp. */
export function aestClock(seconds: number): { hour: number; minute: number; day: number } {
	const t = new Date(seconds * 1000 + OFFSET);
	return { hour: t.getUTCHours(), minute: t.getUTCMinutes(), day: t.getUTCDay() };
}
