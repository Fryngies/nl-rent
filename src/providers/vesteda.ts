import { String, Option, pipe, Effect, flow, Array } from 'effect';
import { Schema } from '@effect/schema';
import { HTMLElement } from 'node-html-parser';
import { Ad } from '../ad';
import { AdId } from '../ad';
import { parseHtml } from '../lib/html';
import { getText } from '../lib/http';

const querySelector = (root: HTMLElement) => (selector: string) =>
	Option.fromNullable(root.querySelector(selector));

export const parseAd = (root: HTMLElement): Option.Option<Ad> =>
	Option.gen(function* (_) {
		const select = querySelector(root);

		const path = yield* pipe(
			select('a'),
			Option.flatMapNullable((n) => n.getAttribute('href')),
		);

		const id = yield* pipe(
			path,
			String.match(/-(\d+)$/),
			Option.flatMap(Array.last),
			Option.flatMap(Schema.decodeUnknownOption(AdId)),
		);

		const city = pipe(
			select('strong.u-heading.u-margin-bottom-none'),
			Option.map((n) => n.textContent),
			Option.map(String.trim),
		);

		const type = pipe(
			select('.o-card--listview-price'),
			Option.map((n) =>
				n.textContent.endsWith('per month') ? 'rent' : 'sale',
			),
		);

		const livingAreaM2 = pipe(
			select('.o-card__top-bottom ul li:first-child'),
			Option.map((n) => n.textContent),
			Option.flatMap(String.match(/(\d+)/)),
			Option.flatMap(Array.last),
			Option.flatMap(Schema.decodeUnknownOption(Schema.NumberFromString)),
		);

		const bedrooms = pipe(
			select('.o-card__top-bottom ul li:nth-child(2)'),
			Option.map((n) => n.textContent),
			Option.flatMap(String.match(/(\d+)$/)),
			Option.flatMap(Array.last),
			Option.flatMap(Schema.decodeOption(Schema.NumberFromString)),
		);

		const pricePerMonth = pipe(
			select('.o-card--listview-price'),
			Option.map((n) => n.textContent),
			Schema.decodeUnknownOption(Schema.String),
			Option.flatMap(String.match(/([\d,]+)/)),
			Option.flatMap(Array.get(1)),
			Option.map(String.replace(',', '')),
			Option.flatMap(Schema.decodeOption(Schema.NumberFromString)),
		);

		const photo = pipe(
			select('picture source'),
			Option.flatMapNullable((e) => e.getAttribute('srcset')),
			Option.flatMap(
				flow(
					String.split(','),
					Array.map(String.trim),
					Array.map(String.replace(/ \d+\w$/, '')),
					Array.last,
				),
			),
		);

		const propertyType = Option.map(
			select('.o-card__top-bottom ul li:last-child'),
			(n) => (n.textContent.includes('house') ? 'house' : 'apartment'),
		);

		return {
			id,
			url: `https://www.vesteda.com${path}`,
			type,
			propertyType,
			address: Option.all({
				title: pipe(
					select('.o-card--listview-content h3 span'),
					Option.map((n) => n.textContent),
				),
				city,
			}),
			livingAreaM2,
			photosUrls: pipe(photo, Option.map(Array.of)),
			pricePerMonth,
			bedrooms,
			// TODO: Implement
			exteriorAreaM2: Option.none(),
			desposit: Option.none(),
			numberOfStories: Option.none(),
			energyLabel: Option.none(),
			yearOfConstruction: Option.none(),
		};
	});

export const runFor = (url: string) =>
	Effect.gen(function* () {
		const response = yield* getText(url);

		yield* Effect.logDebug(`${url} got response ${response}`);

		const node = yield* parseHtml(response);

		const results = node.querySelectorAll(
			'[data-cy="unit-search-results-list"] li',
		);

		yield* Effect.logDebug(`${results.length} items`);

		const ads = pipe(results, Array.fromIterable, Array.map(parseAd));

		return ads;
	});
