import { String, Option, pipe, ReadonlyArray, Effect, flow } from 'effect';
import * as S from '@effect/schema/Schema';
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
				/^\/(\w+)-for-(\w+)\/([\w\d-]+)\/([\w\d]+)\/([\w\d-]+)$/,
			),
		),
		Option.flatMap((matches) => {
			const [url, propertyType, type, city, id] = matches;

			return pipe(
				id,
				S.parseOption(AdId),
				Option.map((id) => ({
					url: `https://www.pararius.com${url}`,
					id,
					city: S.parseOption(S.string)(city).pipe(
						Option.map(
							flow(
								String.split('-'),
								ReadonlyArray.map(String.capitalize),
								ReadonlyArray.join(' '),
							),
						),
					),
					type: S.parseOption(Type)(type),
					propertyType: S.parseOption(PropertyType)(propertyType),
				})),
			);
		}),
	);

	const addressTitle = pipe(
		// not a typo
		root.querySelector(".listing-search-item__sub-title\\'")?.textContent,
		S.parseOption(S.string),
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
					S.parseOption(S.string),
					Option.flatMap(String.match(/^(\d+)/)),
					Option.flatMap(ReadonlyArray.get(1)),
					Option.flatMap(S.parseOption(S.NumberFromString)),
				),
				bedrooms: pipe(
					bedrooms?.textContent,
					S.parseOption(S.string),
					Option.flatMap(String.match(/^(\d+)/)),
					Option.flatMap(ReadonlyArray.get(1)),
					Option.flatMap(S.parseOption(S.NumberFromString)),
				),
			};
		},
	);

	const pricePerMonth = pipe(
		root.querySelector('.listing-search-item__price')?.textContent,
		S.parseOption(S.string),
		Option.flatMap(String.match(/([\d,]+)/)),
		Option.flatMap(ReadonlyArray.get(1)),
		Option.map(String.replace(',', '')),
		Option.flatMap(S.parseOption(S.NumberFromString)),
	);

	const photosUrls = pipe(
		root.querySelector('img.picture__image'),
		Option.fromNullable,
		Option.flatMapNullable((e) => e.getAttribute('src')),
		Option.map(ReadonlyArray.of),
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
	Effect.gen(function* (_) {
		const response = yield* _(getText(url));

		yield* _(Effect.logDebug(`${url} got response ${response.slice(0, 20)}`));

		const node = yield* _(parseHtml(response));

		const results = node.querySelectorAll(
			'.search-list li.search-list__item--listing',
		);

		const ads = pipe(
			results,
			ReadonlyArray.fromIterable,
			ReadonlyArray.map(parseAd),
		);

		return ads;
	});
