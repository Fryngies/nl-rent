import { String, Option, pipe, Effect, flow, Array } from 'effect';
import { Schema } from '@effect/schema';
import { HTMLElement } from 'node-html-parser';
import { Ad, PropertyType, Type } from '../ad';
import { AdId } from '../ad';
import { parseHtml } from '../lib/html';
import { getText } from '../lib/http';

export const parseAd = (root: HTMLElement): Option.Option<Ad> => {
	const urlNode = Option.fromNullable(
		root.querySelector('a.listing-search-item__link'),
	);

	const urlMeta = pipe(
		urlNode,
		Option.flatMapNullable((node) => node.getAttribute('href')),
		Option.flatMap(
			String.match(
				// /apartment-for-rent/amsterdam/8b52839a/kleiburg
				/^\/(\w+)-for-(\w+)\/([\w\d-]+)\/([\w\d]+)\//,
			),
		),
		Option.flatMap((matches) => {
			const [path, propertyType, type, city, id] = matches;

			return pipe(
				id,
				Schema.decodeUnknownOption(AdId),
				Option.map((id) => ({
					url: `https://www.pararius.com${path}`,
					id,
					city: Schema.decodeUnknownOption(Schema.String)(city).pipe(
						Option.map(
							flow(
								String.split('-'),
								Array.map(String.capitalize),
								Array.join(' '),
							),
						),
					),
					type: Schema.decodeUnknownOption(Type)(type),
					propertyType: Schema.decodeUnknownOption(PropertyType)(propertyType),
				})),
			);
		}),
	);

	const addressTitle = pipe(
		// not a typo
		root.querySelector(".listing-search-item__sub-title\\'")?.textContent,
		Schema.decodeUnknownOption(Schema.String),
		Option.map(String.trim),
		Option.map(String.replaceAll(/\s+/g, ' ')),
	);

	const features = pipe(
		root.querySelectorAll('.listing-search-item__features ul li'),
		(es) => {
			const [livingArea, bedrooms] = es;

			return {
				livingArea: pipe(
					livingArea?.textContent,
					Schema.decodeUnknownOption(Schema.String),
					Option.flatMap(String.match(/^(\d+)/)),
					Option.flatMap(Array.get(1)),
					Option.flatMap(Schema.decodeOption(Schema.NumberFromString)),
				),
				bedrooms: pipe(
					bedrooms?.textContent,
					Schema.decodeUnknownOption(Schema.String),
					Option.flatMap(String.match(/^(\d+)/)),
					Option.flatMap(Array.get(1)),
					Option.flatMap(Schema.decodeOption(Schema.NumberFromString)),
				),
			};
		},
	);

	const pricePerMonth = pipe(
		root.querySelector('.listing-search-item__price')?.textContent,
		Schema.decodeUnknownOption(Schema.String),
		Option.flatMap(String.match(/([\d,]+)/)),
		Option.flatMap(Array.get(1)),
		Option.map(String.replace(',', '')),
		Option.flatMap(Schema.decodeOption(Schema.NumberFromString)),
	);

	const photosUrls = pipe(
		root.querySelector('img.picture__image'),
		Option.fromNullable,
		Option.flatMapNullable((e) => e.getAttribute('src')),
		Option.map(Array.of),
	);

	return pipe(
		urlMeta,
		Option.map(
			(meta): Ad => ({
				id: meta.id,
				type: meta.type,
				propertyType: meta.propertyType,
				url: meta.url,
				address: Option.all({ title: addressTitle, city: meta.city }),
				livingAreaM2: features.livingArea,
				photosUrls,
				pricePerMonth,
				bedrooms: features.bedrooms,
				// TODO: Implement
				exteriorAreaM2: Option.none(),
				desposit: Option.none(),
				numberOfStories: Option.none(),
				energyLabel: Option.none(),
				yearOfConstruction: Option.none(),
			}),
		),
	);
};

export const runFor = (url: string) =>
	Effect.gen(function* () {
		const response = yield* getText(url);

		yield* Effect.logDebug(`${url} got response ${response}`);

		const node = yield* parseHtml(response);

		const results = node.querySelectorAll(
			'.search-list li.search-list__item--listing',
		);

		yield* Effect.logDebug(`${results.length} items`);

		const ads = pipe(results, Array.fromIterable, Array.map(parseAd));

		return ads;
	});
