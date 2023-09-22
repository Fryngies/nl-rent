import * as S from '@effect/schema/Schema';
import { NonEmptyString } from './lib/schema';
import { Option } from 'effect';

export const AdId = S.string.pipe(S.pattern(/^[\d\w]+$/), S.brand('AdId'));

export type AdId = S.Schema.To<typeof AdId>;

export const Type = S.literal('sale', 'rent');

export type Type = S.Schema.To<typeof Type>;

export const AdStatus = S.literal('available', 'under negotiation', 'rented');

export type AdStatus = S.Schema<typeof AdStatus>;

export const PropertyType = S.literal('house', 'apartment');

export type PropertyType = S.Schema.To<typeof PropertyType>;

export interface Address {
	readonly title: string;
	readonly city: string;
}

export const Address: S.Schema<Address> = S.struct({
	title: NonEmptyString,
	city: NonEmptyString,
});

export interface Ad {
	readonly id: AdId;
	readonly url: string;
	readonly type: Option.Option<Type>;
	readonly propertyType: Option.Option<PropertyType>;
	readonly address: Option.Option<Address>;
	readonly livingAreaM2: Option.Option<number>;
	readonly exteriorAreaM2: Option.Option<number>;
	readonly pricePerMonth: Option.Option<number>;
	readonly desposit: Option.Option<number>;
	readonly numberOfStories: Option.Option<number>;
	readonly bedrooms: Option.Option<number>;
	readonly energyLabel: Option.Option<string>;
	readonly yearOfConstruction: Option.Option<number>;
	readonly photosUrls: Option.Option<readonly string[]>;
}
