import * as z from 'zod';
import { createAuthEndpoint } from '@better-auth/core/api';
import type { BetterAuthPlugin } from '@better-auth/core';
import { APIError, sessionMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { generateJson } from '$lib/server/openrouter';

export const SOUTHBAG_ID_ERROR_CODES = {
	NOT_A_FACE: 'That is not a face. Southbag Identity™ only accepts faces.',
	ALREADY_ENROLLED: 'This face is already on file. Faces are forever.',
	NOT_ENROLLED: 'No face on file. Please enrol a face first.',
	UNKNOWN_FACE_ID: 'That Southbag ID™ code is not in the face vault.',
	FACE_MISMATCH: 'The faces do not match. You are not you.',
	INVALID_PHOTO: 'That photo is not a photo.',
	VISION_FAILED: 'The face computer is unavailable. Please look at a wall and try again.'
} as const;

const MAX_PHOTO_BYTES = 900_000;

const photoSchema = z
	.string()
	.min(32)
	.refine((value) => value.startsWith('data:image/'), {
		message: SOUTHBAG_ID_ERROR_CODES.INVALID_PHOTO
	})
	.refine((value) => value.length <= MAX_PHOTO_BYTES, {
		message: 'That photo is far too large. Southbag only has one bag.'
	});

type FaceCheck = {
	isFace: boolean;
	dateOfBirth: string;
	confidence: number;
	notes: string;
};

type FaceMatch = {
	samePerson: boolean;
	confidence: number;
	notes: string;
};

const FACE_CHECK_SCHEMA = {
	type: 'object',
	properties: {
		isFace: {
			type: 'boolean',
			description: 'True only if the image clearly contains a single human face.'
		},
		dateOfBirth: {
			type: 'string',
			description: 'Best estimated date of birth in YYYY-MM-DD format. Use 1900-01-01 if no face.'
		},
		confidence: {
			type: 'number',
			description: 'Confidence in the date-of-birth estimate, between 0 and 1.'
		},
		notes: {
			type: 'string',
			description: 'One short sentence explaining the verdict.'
		}
	},
	required: ['isFace', 'dateOfBirth', 'confidence', 'notes'],
	additionalProperties: false
};

const FACE_MATCH_SCHEMA = {
	type: 'object',
	properties: {
		samePerson: {
			type: 'boolean',
			description: 'True only if both images show the same human being.'
		},
		confidence: {
			type: 'number',
			description: 'Confidence in the match decision, between 0 and 1.'
		},
		notes: {
			type: 'string',
			description: 'One short sentence explaining the decision.'
		}
	},
	required: ['samePerson', 'confidence', 'notes'],
	additionalProperties: false
};

const FACE_CHECK_PROMPT = [
	'You are the enrolment camera for a bank called Southbag.',
	'Look at the attached image.',
	'Decide whether it contains exactly one clearly visible human face.',
	'If it does, estimate that person’s date of birth in YYYY-MM-DD format.',
	'If there is no face, or the face is a drawing, animal, statue, or object, set isFace to false and dateOfBirth to 1900-01-01.',
	'Answer only with the JSON object described by the schema.'
].join(' ');

const FACE_MATCH_PROMPT = [
	'You are the door camera for a bank called Southbag.',
	'The FIRST image is the enrolled reference photo on file.',
	'The SECOND image is the person standing at the camera right now.',
	'Decide whether both images show the same human being.',
	'Ignore lighting, hairstyle, glasses, facial hair, camera quality and age differences of a few years.',
	'If either image has no visible human face, set samePerson to false.',
	'Answer only with the JSON object described by the schema.'
].join(' ');

type SouthbagIdCredentialRow = {
	id: string;
	userId: string;
	faceId: string;
	photo: string;
	dateOfBirth: string;
	verdict: string | null;
	createdAt: Date;
	updatedAt: Date;
};

const publicCredential = (row: SouthbagIdCredentialRow) => ({
	faceId: row.faceId,
	dateOfBirth: row.dateOfBirth,
	verdict: row.verdict,
	photo: row.photo,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt
});

/**
 * Southbag ID™ — take a photo of your face, get a QR code, log in with your head.
 */
export const southbagId = () =>
	({
		id: 'southbag-id',
		schema: {
			southbagIdCredential: {
				fields: {
					userId: {
						type: 'string',
						required: true,
						references: { model: 'user', field: 'id', onDelete: 'cascade' }
					},
					faceId: { type: 'string', required: true, unique: true },
					photo: { type: 'string', required: true },
					dateOfBirth: { type: 'string', required: true },
					verdict: { type: 'string', required: false },
					createdAt: { type: 'date', required: true },
					updatedAt: { type: 'date', required: true }
				}
			}
		},
		endpoints: {
			/**
			 * Send the photo to the face computer and record its estimated date of birth.
			 */
			enrolSouthbagId: createAuthEndpoint(
				'/southbag-id/enrol',
				{
					method: 'POST',
					use: [sessionMiddleware],
					body: z.object({ photo: photoSchema }),
					metadata: {
						openapi: {
							description: 'Enrol the current user’s face into Southbag Identity™'
						}
					}
				},
				async (ctx) => {
					const { user } = ctx.context.session;

					let check: FaceCheck;
					try {
						check = await generateJson<FaceCheck>({
							prompt: FACE_CHECK_PROMPT,
							images: [ctx.body.photo],
							schemaName: 'southbag_face_check',
							schema: FACE_CHECK_SCHEMA
						});
					} catch (error) {
						throw new APIError('SERVICE_UNAVAILABLE', {
							message:
								error instanceof Error
									? `${SOUTHBAG_ID_ERROR_CODES.VISION_FAILED} (${error.message})`
									: SOUTHBAG_ID_ERROR_CODES.VISION_FAILED
						});
					}

					if (!check.isFace) {
						throw new APIError('BAD_REQUEST', {
							message: `${SOUTHBAG_ID_ERROR_CODES.NOT_A_FACE} ${check.notes ?? ''}`.trim(),
							code: 'NOT_A_FACE'
						});
					}

					const existing = (await ctx.context.adapter.findOne({
						model: 'southbagIdCredential',
						where: [{ field: 'userId', value: user.id }]
					})) as SouthbagIdCredentialRow | null;

					const now = new Date();

					// The estimated date of birth is recorded once.
					if (existing) {
						const updated = (await ctx.context.adapter.update({
							model: 'southbagIdCredential',
							where: [{ field: 'id', value: existing.id }],
							update: {
								photo: ctx.body.photo,
								verdict: check.notes ?? '',
								updatedAt: now
							}
						})) as SouthbagIdCredentialRow | null;

						return ctx.json({
							...publicCredential(updated ?? { ...existing, photo: ctx.body.photo, updatedAt: now }),
							estimatedDateOfBirth: check.dateOfBirth,
							notes: check.notes ?? ''
						});
					}

					const created = (await ctx.context.adapter.create({
						model: 'southbagIdCredential',
						data: {
							userId: user.id,
							faceId: crypto.randomUUID(),
							photo: ctx.body.photo,
							dateOfBirth: check.dateOfBirth,
							verdict: check.notes ?? '',
							createdAt: now,
							updatedAt: now
						}
					})) as SouthbagIdCredentialRow;

					return ctx.json({
						...publicCredential(created),
						estimatedDateOfBirth: created.dateOfBirth,
						notes: check.notes ?? ''
					});
				}
			),

			/**
			 * What Southbag currently thinks your face is.
			 */
			getSouthbagId: createAuthEndpoint(
				'/southbag-id/credential',
				{
					method: 'GET',
					use: [sessionMiddleware],
					metadata: {
						openapi: { description: 'Get the current user’s Southbag ID™ enrolment' }
					}
				},
				async (ctx) => {
					const row = (await ctx.context.adapter.findOne({
						model: 'southbagIdCredential',
						where: [{ field: 'userId', value: ctx.context.session.user.id }]
					})) as SouthbagIdCredentialRow | null;

					if (!row) return ctx.json({ enrolled: false as const });
					return ctx.json({ enrolled: true as const, ...publicCredential(row) });
				}
			),

			/**
			 * Remove the enrolled face and its estimated date of birth.
			 */
			forgetSouthbagId: createAuthEndpoint(
				'/southbag-id/forget',
				{
					method: 'POST',
					use: [sessionMiddleware],
					metadata: { openapi: { description: 'Delete the current user’s enrolled face' } }
				},
				async (ctx) => {
					await ctx.context.adapter.delete({
						model: 'southbagIdCredential',
						where: [{ field: 'userId', value: ctx.context.session.user.id }]
					});
					return ctx.json({ success: true });
				}
			),

			/**
			 * Login: scan the QR code, take a photo, let the face computer decide.
			 */
			signInSouthbagId: createAuthEndpoint(
				'/sign-in/southbag-id',
				{
					method: 'POST',
					body: z.object({
						faceId: z.string().min(1),
						photo: photoSchema
					}),
					metadata: {
						openapi: { description: 'Sign in with a Southbag ID™ QR code and a face' }
					}
				},
				async (ctx) => {
					const credential = (await ctx.context.adapter.findOne({
						model: 'southbagIdCredential',
						where: [{ field: 'faceId', value: ctx.body.faceId }]
					})) as SouthbagIdCredentialRow | null;

					if (!credential) {
						throw new APIError('BAD_REQUEST', {
							message: SOUTHBAG_ID_ERROR_CODES.UNKNOWN_FACE_ID,
							code: 'UNKNOWN_FACE_ID'
						});
					}

					const user = await ctx.context.internalAdapter.findUserById(credential.userId);
					if (!user) {
						throw new APIError('BAD_REQUEST', {
							message: SOUTHBAG_ID_ERROR_CODES.UNKNOWN_FACE_ID,
							code: 'UNKNOWN_FACE_ID'
						});
					}

					let match: FaceMatch;
					try {
						match = await generateJson<FaceMatch>({
							prompt: FACE_MATCH_PROMPT,
							images: [credential.photo, ctx.body.photo],
							schemaName: 'southbag_face_match',
							schema: FACE_MATCH_SCHEMA
						});
					} catch (error) {
						throw new APIError('SERVICE_UNAVAILABLE', {
							message:
								error instanceof Error
									? `${SOUTHBAG_ID_ERROR_CODES.VISION_FAILED} (${error.message})`
									: SOUTHBAG_ID_ERROR_CODES.VISION_FAILED
						});
					}

					if (!match.samePerson) {
						throw new APIError('UNAUTHORIZED', {
							message: `${SOUTHBAG_ID_ERROR_CODES.FACE_MISMATCH} ${match.notes ?? ''}`.trim(),
							code: 'FACE_MISMATCH'
						});
					}

					const session = await ctx.context.internalAdapter.createSession(user.id);
					if (!session) {
						throw new APIError('INTERNAL_SERVER_ERROR', {
							message: 'Could not create a session for that face.'
						});
					}

					await setSessionCookie(ctx, { session, user });

					return ctx.json({
						token: session.token,
						confidence: match.confidence,
						notes: match.notes ?? '',
						user: {
							id: user.id,
							email: user.email,
							name: user.name,
							image: user.image ?? null,
							emailVerified: user.emailVerified,
							createdAt: user.createdAt,
							updatedAt: user.updatedAt
						}
					});
				}
			)
		},
		$ERROR_CODES: SOUTHBAG_ID_ERROR_CODES
	}) satisfies BetterAuthPlugin;
