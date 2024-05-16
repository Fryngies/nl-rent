import { FileSystem } from '@effect/platform';
import { NodeFileSystem } from '@effect/platform-node';
import { Effect, Option } from 'effect';
import { parseHtml } from '../lib/html';
import { parseAd, selectAds } from './funda';
import { Ad, AdId } from '../ad';

describe('funda', async () => {
	const testNodes = await Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		const contents = (yield* fs.readFile(
			`${import.meta.dirname}/funda.mock.html`,
		)).toString();

		return yield* parseHtml(contents);
	}).pipe(Effect.provide(NodeFileSystem.layer), Effect.runPromise);

	describe('selectAds', () => {
		it('should select ad nodes from root', () => {
			const selected = selectAds(testNodes);

			expect(selected).toHaveLength(15);
		});
	});

	describe('parseAd', () => {
		it('should parse single ad', () => {
			const [testAd] = selectAds(testNodes);

			if (!testAd) {
				throw new TypeError('cannot extract test ad');
			}

			expect(parseAd(testAd)).toStrictEqual<Option.Option<Ad>>(
				Option.some({
					address: Option.some({
						city: 'Amsterdam',
						title: 'Sassenheimstraat 7 2',
					}),
					bedrooms: Option.some(2),
					desposit: Option.none(),
					energyLabel: Option.some('A'),
					exteriorAreaM2: Option.none(),
					livingAreaM2: Option.some(53),
					numberOfStories: Option.none(),
					pricePerMonth: Option.some(2200),
					propertyType: Option.some('apartment'),
					type: Option.some('rent'),
					photosUrls: Option.some([
						'https://cloud.funda.nl/valentina_media/190/379/834_720x480.jpg',
					]),
					url: 'https://www.funda.nl/huur/amsterdam/appartement-43597237-sassenheimstraat-7-2/',
					yearOfConstruction: Option.none(),
					id: AdId.make('43597237'),
				}),
			);
		});

		it('should parse every ad from the test cases', () => {
			const ads = selectAds(testNodes);

			expect(ads.map(parseAd)).not.toContain(Option.none());
		});
	});
});
