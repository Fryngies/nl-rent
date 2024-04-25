import { Effect, Option, ReadonlyArray, String, pipe } from 'effect';
import { HTMLElement } from 'node-html-parser';
import * as S from '@effect/schema/Schema';
import { getText } from '../lib/http';
import { parseHtml } from '../lib/html';
import { NonEmptyString } from '../lib/schema';
import { Ad, AdId, PropertyType, Type } from '../ad';

export const FundaType = S.literal('koop', 'huur');

export type FundaType = 'koop' | 'huur';

const fundaTypeToTypeMap: Record<FundaType, Type> = {
	koop: 'sale',
	huur: 'rent',
};

const FundaPropertyType = S.literal('huis', 'appartement');

type FundaPropertyType = 'huis' | 'appartement';

const fundaPropertyTypeToPropertyType: Record<FundaPropertyType, PropertyType> =
	{
		huis: 'house',
		appartement: 'apartment',
	};

export const parseAd = (root: HTMLElement): Option.Option<Ad> => {
	const image = pipe(
		root.querySelector('[data-test-id="object-image-link"]'),
		Option.fromNullable,
	);

	const url = pipe(
		image,
		Option.flatMap((b) => Option.fromNullable(b.getAttribute('href'))),
	);

	const imageUrl = pipe(
		image,
		Option.flatMap((b) => Option.fromNullable(b.querySelector('img'))),
		Option.flatMap((b) => Option.fromNullable(b.getAttribute('srcset'))),
		Option.flatMap((set) => pipe(set.split(','), ReadonlyArray.last)),
		Option.map(String.replace(/ \d+\w$/, '')),
	);

	const urlInfo = pipe(
		url,
		Option.flatMap(
			// https://www.funda.nl/detail/huur/amsterdam/appartement-frans-van-mierisstraat-69-ii/43448018/
			String.match(
				/https:\/\/www\.funda\.nl\/detail\/(\w+)\/([\w\d]+)\/(\w+)-[\w\d-]+\/([\d]+)/,
			),
		),
		Option.flatMap((matches: unknown[]) => {
			const [, type, city, propertyType, id] = matches;

			return pipe(
				id,
				S.parseOption(AdId),
				Option.map((id) => ({
					id,
					type: pipe(
						type,
						S.parseOption(FundaType),
						Option.map((dt) => fundaTypeToTypeMap[dt]),
					),
					city: pipe(
						city,
						S.parseOption(NonEmptyString),
						Option.map(String.trim),
						Option.map(
							([first, ...rest]) =>
								`${String.toUpperCase(first)}${ReadonlyArray.join(rest, '')}`,
						),
					),
					propertyType: pipe(
						propertyType,
						S.parseOption(FundaPropertyType),
						Option.map((dpt) => fundaPropertyTypeToPropertyType[dpt]),
					),
				})),
			);
		}),
	);

	const { livingAreaM2, bedrooms, energyLabel } = pipe(
		root.querySelectorAll('ul.mt-1 li'),
		(blocks) => {
			const contents: unknown[] = pipe(
				blocks,
				ReadonlyArray.fromIterable,
				ReadonlyArray.map((b) => b.textContent),
			);

			return {
				livingAreaM2: pipe(
					contents[0],
					S.parseOption(NonEmptyString),
					Option.map(String.replaceAll(/[^\d]+/g, '')),
					Option.flatMap(S.parseOption(S.NumberFromString)),
				),
				bedrooms: pipe(
					contents[1],
					S.parseOption(NonEmptyString),
					Option.flatMap(S.parseOption(S.NumberFromString.pipe(S.int()))),
				),
				energyLabel: pipe(
					contents[2],
					S.parseOption(NonEmptyString),
					Option.map(String.trim),
					Option.flatMap(S.parseOption(NonEmptyString)),
				),
			};
		},
	);

	const title = pipe(
		root.querySelector('[data-test-id="street-name-house-number"]'),
		Option.fromNullable,
		Option.map((e) => e.textContent),
		Option.flatMap(S.parseOption(NonEmptyString)),
		Option.map((s) => s.trim()),
	);

	const pricePerMonth = pipe(
		root.querySelector('[data-test-id="price-rent"]'),
		Option.fromNullable,
		Option.flatMap((s) => Option.fromNullable(s.textContent)),
		Option.map(String.replaceAll(/[^\d]+/g, '')),
		Option.flatMap(S.parseOption(S.NumberFromString)),
	);

	return pipe(
		Option.all({ urlInfo, url }),
		Option.map(({ urlInfo, url }) => ({
			id: urlInfo.id,
			type: urlInfo.type,
			propertyType: urlInfo.propertyType,
			address: Option.all({
				title,
				city: urlInfo.city,
			}),
			url,
			livingAreaM2,
			bedrooms,
			energyLabel,
			pricePerMonth,
			photosUrls: pipe(imageUrl, Option.map(ReadonlyArray.of)),
			// TODO: Implement
			desposit: Option.none(),
			numberOfStories: Option.none(),
			yearOfConstruction: Option.none(),
			exteriorAreaM2: Option.none(),
		})),
	);
};

export const runFor = (url: string) =>
	Effect.gen(function* (_) {
		const response = yield* _(getText(url));

		yield* _(Effect.logDebug(`${url} got response ${response.slice(0, 20)}`));

		const node = yield* _(parseHtml(response));

		const results = node.querySelectorAll(
			'[componentid="search_result"] [data-test-id="search-result-item"]',
		);

		const ads = pipe(
			results,
			ReadonlyArray.fromIterable,
			ReadonlyArray.map(parseAd),
		);

		return ads;
	});
