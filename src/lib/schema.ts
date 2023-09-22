import * as S from '@effect/schema/Schema';

export const NonEmptyString = S.string.pipe(S.nonEmpty());
