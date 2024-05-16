import * as HttpClient from '@effect/platform/HttpClient';
import {
	Effect,
	Option,
	flow,
	pipe,
	String,
	Logger,
	LogLevel,
	Array,
} from 'effect';
import { Ad } from './ad';
import {
	AdIdStorage,
	KVNamespaceTag,
	KeyValueCFStoreLive as KeyValueCFStoreLayer,
	newAdIdStorageLive,
} from './ad-storage';
import { HtmlParseError } from './lib/html';
import { TelegramChatService } from './lib/telegram';
import * as Funda from './providers/funda';
import { HttpClientError } from '@effect/platform/Http/ClientError';
import { Fetch } from './lib/http';

interface Source {
	readonly url: string;
	readonly process: (
		url: string,
	) => Effect.Effect<
		Option.Option<Ad>[],
		HttpClientError | HtmlParseError,
		Fetch
	>;
}

const funda = (url: string): Source => ({ url, process: Funda.runFor });
// const pararus = (url: string): Source => ({ url, process: Pararius.runFor });

const FUNDA_SOURCES: readonly Source[] = Array.map(
	[
		'https://www.funda.nl/en/zoeken/huur?selected_area=["gemeente-amsterdam"]&price="1000-2500"&object_type=["house","apartment"]&publication_date="10"&floor_area="50-"&sort="date_down"',
		'https://www.funda.nl/en/zoeken/huur?selected_area=["haarlem"]&price="1000-2500"&object_type=["house","apartment"]&publication_date="10"&floor_area="50-"&sort="date_down"',
		'https://www.funda.nl/en/zoeken/huur?selected_area=["utrecht"]&price="1000-2500"&object_type=["house","apartment"]&publication_date="10"&floor_area="50-"&sort="date_down"',
		'https://www.funda.nl/en/zoeken/huur?selected_area=["amstelveen"]&price="1000-2500"&object_type=["house","apartment"]&publication_date="10"&floor_area="50-"&sort="date_down"',
	],
	funda,
);

// const PARARIUS_SOURCES: readonly Source[] = Array.map(
// 	[
// 		'https://www.pararius.com/apartments/amsterdam/1200-2500/2-bedrooms/50m2',
// 		'https://www.pararius.com/apartments/haarlem/1200-2500/2-bedrooms/50m2',
// 		'https://www.pararius.com/apartments/utrecht/1200-2500/2-bedrooms/50m2',
// 		'https://www.pararius.com/apartments/amstelveen/1200-2500/2-bedrooms/50m2',
// 	],
// 	pararus,
// );

export interface Env {
	// https://developers.cloudflare.com/workers/runtime-apis/kv/
	readonly nlRentScrapper: KVNamespace;
	readonly CHAT_ID: string;
	readonly BOT_TOKEN: string;
	readonly BOT_USERNAME: string;
}

const tag = (word: string) => `#${String.replace(/\s+/, '_')(word)}`;

const serializeAd = (ad: Ad) =>
	pipe(
		[
			pipe(
				[
					Option.map(ad.pricePerMonth, (p) =>
						p < 2000 ? '#under2k' : '#above2k',
					),
					Option.map(ad.propertyType, tag),
					Option.flatMap(ad.energyLabel, (l) =>
						l.startsWith('A') || l === 'B'
							? Option.some('#goodEnergyLabel')
							: Option.none(),
					),
					Option.map(ad.address, (a) => tag(a.city)),
				],
				Array.getSomes,
				Array.join(' '),
				(s) => (s.length === 0 ? Option.none() : Option.some(s)),
			),
			Option.map(ad.pricePerMonth, (p) => `💶 ${p} per month`),
			Option.map(ad.energyLabel, (e) => `⚡️ ${e}`),
			Option.map(ad.livingAreaM2, (l) => `🏠 ${l} m²`),
			Option.map(ad.bedrooms, (n) => `🛏️ ${n}`),
			Option.map(ad.desposit, (d) => `💰 ${d}`),
			Option.some(ad.url),
			Option.map(
				ad.address,
				(a) =>
					`\n📍 <a href="https://maps.google.com/?q=${a.city}, ${a.title}">${a.city}, ${a.title}</a>`,
			),
		],
		Array.getSomes,
		Array.join('\n'),
	);

const task = (sources: readonly Source[]) =>
	Effect.gen(function* (_) {
		const maybeAds = yield* _(
			pipe(
				sources,
				Effect.validateAll((source) =>
					Effect.gen(function* () {
						yield* Effect.logInfo(`processing ${source.url}`);

						return yield* source.process(source.url);
					}),
				),
				Effect.map(Array.flatten),
			),
		);
		const tgClient = yield* TelegramChatService;
		const adStorage = yield* AdIdStorage;

		const ads = pipe(maybeAds, Array.getSomes);

		const newIds = yield* adStorage.put(Array.map(ads, (ad) => ad.id));
		const toPost = ads.filter((ad) => newIds.includes(ad.id));

		yield* Effect.logDebug(`parsed ${JSON.stringify(maybeAds)}`);
		yield* Effect.logInfo(
			`got: ${maybeAds.length}, failed: ${
				maybeAds.length - Array.getSomes(maybeAds).length
			}, new: ${toPost.length}`,
		);
		yield* Effect.logDebug(`toPost: ${toPost}; newIds: ${newIds}`);

		yield* Effect.partition(
			toPost,
			flow(
				Effect.succeed,
				Effect.tap((ad) => Effect.log(`posting ${ad.id} to Telegram`)),
				Effect.map(serializeAd),
				Effect.flatMap(tgClient.post),
			),
		);
	});

export default {
	async scheduled(_: ScheduledEvent, env: Env): Promise<void> {
		const funda = task(FUNDA_SOURCES).pipe(
			Effect.provideServiceEffect(AdIdStorage, newAdIdStorageLive('funda')),
		);

		// const pararius = task(PARARIUS_SOURCES).pipe(
		// 	Effect.provideServiceEffect(AdIdStorage, newAdIdStorageLive('pararius')),
		// );
		const pararius = Effect.succeed(undefined);

		return Effect.all([funda, pararius], { concurrency: 'unbounded' }).pipe(
			Effect.map(() => undefined),

			Effect.provideServiceEffect(
				TelegramChatService,
				TelegramChatService.make(env.BOT_TOKEN, env.CHAT_ID),
			),

			Effect.provide(Fetch.Live),
			Effect.provide(HttpClient.client.layer),

			Effect.provide(KeyValueCFStoreLayer),
			Effect.provideService(KVNamespaceTag, env.nlRentScrapper),

			Logger.withMinimumLogLevel(LogLevel.Debug),
			Effect.runPromise,
		);
	},
};
