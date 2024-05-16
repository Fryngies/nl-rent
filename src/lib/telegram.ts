import { Context, Effect } from 'effect';
import * as HttpClient from '@effect/platform/Http/Client';
import * as HttpClientRequest from '@effect/platform/Http/ClientRequest';
import * as Body from '@effect/platform/Http/Body';
import { HttpClientError } from '@effect/platform/Http/ClientError';
import * as ClientResponse from '@effect/platform/Http/ClientResponse';
import { Fetch } from './http';

export class TelegramChatService extends Context.Tag('TelegramChatService')<
	TelegramChatService,
	{
		post(html: string): Effect.Effect<string, Body.BodyError | HttpClientError>;
	}
>() {
	static make = (token: string, chatId: string) =>
		Effect.gen(function* () {
			const fetch = (yield* Fetch).pipe(
				HttpClient.mapRequest(
					HttpClientRequest.prependUrl(`https://api.telegram.org/bot${token}/`),
				),
			);

			return TelegramChatService.of({
				post: (html) =>
					Effect.gen(function* () {
						const body = yield* Body.json({
							chat_id: chatId,
							text: html,
							parse_mode: 'HTML',
						});

						yield* Effect.logDebug(`sending message:\n${html}`);

						const request = HttpClientRequest.post('sendMessage', { body });
						const response = yield* fetch(request).pipe(ClientResponse.text);

						yield* Effect.logDebug(`response ${response}`);

						return response;
					}),
			});
		});
}
