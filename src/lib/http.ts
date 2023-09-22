import { Effect, pipe } from 'effect';

export class HttpRequestError extends Error {
	readonly _tag = 'HttpError';
	constructor(readonly e: unknown) {
		super('HttpErrror');
	}
}

export class HttpBadResponseError extends Error {
	readonly _tag = 'HttpError';
	constructor(readonly r: Response) {
		super('HttpErrror');
	}
}

export class HttpTextResponseParseError extends Error {
	readonly _tag = 'HttpTextResponseParseError';
	constructor(readonly r: Response) {
		super('HttpTextResponseParseError');
	}
}

export type HttpError =
	| HttpRequestError
	| HttpBadResponseError
	| HttpTextResponseParseError;

export const getText = (url: string) =>
	pipe(
		Effect.tryPromise((signal) => fetch(url, { signal })),
		Effect.matchEffect({
			onSuccess: (r) => {
				if (!r.ok) return Effect.fail<HttpError>(new HttpBadResponseError(r));

				return Effect.tryPromise({
					try: () => r.text(),
					catch: () => new HttpTextResponseParseError(r),
				});
			},
			onFailure: (e) => Effect.fail(new HttpRequestError(e)),
		}),
	);
