import { Context, Effect, Schedule } from 'effect';
import * as HttpClient from '@effect/platform/Http/Client';
import * as HttpClientRequest from '@effect/platform/Http/ClientRequest';
import * as Body from '@effect/platform/Http/Body';
import { HttpClientError } from '@effect/platform/Http/ClientError';

export interface TelegramChatService {
	post(
		html: string,
	): Effect.Effect<never, Body.BodyError | HttpClientError, void>;
}

export const TelegramChatService = Context.Tag<TelegramChatService>();

export const newTelegramChatService = (token: string, chatId: string) =>
	Effect.gen(function* (_) {
		const fetch = (yield* _(HttpClient.Client)).pipe(
			HttpClient.mapRequest(
				HttpClientRequest.prependUrl(`https://api.telegram.org/bot${token}/`),
			),
			HttpClient.retry(retryPolicy),
			HttpClient.filterStatusOk,
		);
		yield* _(
			Effect.logDebug(
				`created TelegramChatService ${token.length} ${chatId.length}`,
			),
		);

		return TelegramChatService.of({
			post: (html) =>
				Effect.gen(function* (_) {
					const body = yield* _(
						Body.json({
							chat_id: chatId,
							text: html,
							parse_mode: 'HTML',
						}),
					);

					yield* _(Effect.logDebug(`sending message:\n${html}`));

					const request = HttpClientRequest.post('sendMessage', { body });
					const response = yield* _(fetch(request));

					const rText = yield* _(response.text);
					yield* _(Effect.logDebug(`response ${rText}`));

					return response;
				}),
		});
	});

const retryPolicy = Schedule.exponential('1 seconds');
