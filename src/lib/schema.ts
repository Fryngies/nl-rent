import { Schema } from '@effect/schema';

export const NonEmptyString = Schema.String.pipe(Schema.nonEmpty());
