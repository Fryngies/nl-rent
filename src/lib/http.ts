import { HttpClient } from '@effect/platform';
import { Context, Effect, Layer, Schedule, pipe } from 'effect';
import { Scope } from 'effect/Scope';

export class Fetch extends Context.Tag('Fetch')<
	Fetch,
	HttpClient.client.Client<
		HttpClient.response.ClientResponse,
		HttpClient.error.HttpClientError,
		Scope
	>
>() {
	static Live = Layer.effect(
		this,
		Effect.gen(function* () {
			return (yield* HttpClient.client.Client).pipe(
				HttpClient.client.filterStatusOk,
				HttpClient.client.retry(
					Schedule.exponential('1 seconds').pipe(
						Schedule.compose(Schedule.recurs(3)),
					),
				),
			);
		}),
	);
}

export const getText = (url: string) =>
	Effect.gen(function* () {
		const fetch = yield* Fetch;

		return yield* pipe(
			HttpClient.request.get(url),
			fetch,
			HttpClient.response.text,
		);
	});
