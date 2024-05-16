import { Effect, Option, String, pipe, Array, flow } from 'effect';
import { HTMLElement } from 'node-html-parser';
import { Schema } from '@effect/schema';
import { getText } from '../lib/http';
import { parseHtml } from '../lib/html';
import { NonEmptyString } from '../lib/schema';
import { Ad, AdId, PropertyType, Type } from '../ad';

export const FundaType = Schema.Literal('koop', 'huur');

export type FundaType = 'koop' | 'huur';

const fundaTypeToTypeMap: Record<FundaType, Type> = {
	koop: 'sale',
	huur: 'rent',
};

const FundaPropertyType = Schema.Literal('huis', 'appartement');

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
		Option.flatMap((element) =>
			Option.fromNullable(element.querySelector('img')),
		),
		Option.flatMap((element) =>
			Option.fromNullable(element.getAttribute('srcset')),
		),
		Option.flatMap(
			flow(
				String.split(','),
				Array.map(String.trim),
				Array.map(String.replace(/ \d+\w$/, '')),
				Array.last,
			),
		),
	);

	const urlInfo = pipe(
		url,
		Option.flatMap((s) =>
			Option.firstSomeOf([
				// https://www.funda.nl/detail/huur/amsterdam/appartement-frans-van-mierisstraat-69-ii/43448018/
				String.match(
					/https:\/\/www\.funda\.nl\/detail\/(\w+)\/([\w\d]+)\/(\w+)-[\w\d-]+\/([\d]+)/,
				)(s),
				// https://www.funda.nl/huur/amsterdam/appartement-43597237-sassenheimstraat-7-2/
				String.match(
					/https:\/\/www\.funda\.nl\/(\w+)\/([\w\d]+)\/(\w+)-(\d+)-([\w\d-]+)/,
				)(s),
			]),
		),
		Option.map(([, type, city, propertyType, id]) => ({
			type,
			city,
			propertyType,
			id,
		})),
		Option.flatMap((matches) => {
			const { type, city, propertyType, id } = matches;

			return pipe(
				id,
				Schema.decodeUnknownOption(AdId),
				Option.map((id) => ({
					id,
					type: pipe(
						type,
						Schema.decodeUnknownOption(FundaType),
						Option.map((dt) => fundaTypeToTypeMap[dt]),
					),
					city: pipe(
						city,
						Schema.decodeUnknownOption(NonEmptyString),
						Option.map(String.trim),
						Option.map(String.capitalize),
					),
					propertyType: pipe(
						propertyType,
						Schema.decodeUnknownOption(FundaPropertyType),
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
				Array.fromIterable,
				Array.map((b) => b.textContent),
			);

			return {
				livingAreaM2: pipe(
					contents[0],
					Schema.decodeUnknownOption(NonEmptyString),
					Option.map(String.replaceAll(/[^\d]+/g, '')),
					Option.flatMap(Schema.decodeUnknownOption(Schema.NumberFromString)),
				),
				bedrooms: pipe(
					contents[1],
					Schema.decodeUnknownOption(NonEmptyString),
					Option.flatMap(
						Schema.decodeUnknownOption(
							Schema.NumberFromString.pipe(Schema.int()),
						),
					),
				),
				energyLabel: pipe(
					contents[2],
					Schema.decodeUnknownOption(NonEmptyString),
					Option.map(String.trim),
					Option.flatMap(Schema.decodeUnknownOption(NonEmptyString)),
				),
			};
		},
	);

	const title = pipe(
		root.querySelector('[data-test-id="street-name-house-number"]'),
		Option.fromNullable,
		Option.map((e) => e.textContent),
		Option.flatMap(Schema.decodeOption(NonEmptyString)),
		Option.map((s) => s.trim()),
	);

	const pricePerMonth = pipe(
		root.querySelector('[data-test-id="price-rent"]'),
		Option.fromNullable,
		Option.flatMap((s) => Option.fromNullable(s.textContent)),
		Option.map(String.replaceAll(/[^\d]+/g, '')),
		Option.flatMap(Schema.decodeOption(Schema.NumberFromString)),
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
			photosUrls: pipe(imageUrl, Option.map(Array.of)),
			// TODO: Implement
			desposit: Option.none(),
			numberOfStories: Option.none(),
			yearOfConstruction: Option.none(),
			exteriorAreaM2: Option.none(),
		})),
	);
};

export const selectAds = (root: HTMLElement): HTMLElement[] =>
	root.querySelectorAll(
		'[componentid="search_result"] [data-test-id="search-result-item"]',
	);

export const runFor = (url: string) =>
	Effect.gen(function* () {
		const response = yield* getText(url);

		yield* Effect.logDebug(`${url} got response ${response.slice(0, 20)}`);

		const root = yield* parseHtml(response);

		const ads = pipe(root, selectAds, Array.fromIterable, Array.map(parseAd));

		return ads;
	});
