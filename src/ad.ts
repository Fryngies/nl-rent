import { Schema } from '@effect/schema';
import { NonEmptyString } from './lib/schema';
import { Option } from 'effect';

export const AdId = Schema.String.pipe(
	Schema.pattern(/^[\d\w]+$/),
	Schema.brand('AdId'),
);

export type AdId = Schema.Schema.Type<typeof AdId>;

export const Type = Schema.Literal('sale', 'rent');

export type Type = Schema.Schema.Type<typeof Type>;

export const AdStatus = Schema.Literal(
	'available',
	'under negotiation',
	'rented',
);

export type AdStatus = Schema.Schema<typeof AdStatus>;

export const PropertyType = Schema.Literal('house', 'apartment');

export type PropertyType = Schema.Schema.Type<typeof PropertyType>;

export interface Address {
	readonly title: string;
	readonly city: string;
}

export const Address: Schema.Schema<Address> = Schema.Struct({
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
