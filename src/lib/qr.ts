import { renderSVG } from 'uqr';

/**
 * Southbag ID™ QR codes are just the face id with a prefix so we can tell them
 * apart from the many other QR codes people wave at their laptops.
 */
export const QR_PREFIX = 'southbag-id:';

export const toQrPayload = (faceId: string) => `${QR_PREFIX}${faceId}`;

/** Accepts `southbag-id:<uuid>`, a bare uuid, or a Southbag ID™ URL. */
export const fromQrPayload = (text: string) => {
	const trimmed = text.trim();
	const withoutPrefix = trimmed.replace(/^southbag-id:/i, '').trim();
	return withoutPrefix.split(/[?#/]/).filter(Boolean).pop()?.trim() ?? '';
};

export const renderQrSvg = (text: string) =>
	renderSVG(text, {
		border: 2,
		pixelSize: 6,
		ecc: 'M',
		whiteColor: '#ffffff',
		blackColor: '#000000'
	});
