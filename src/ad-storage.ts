import { PlatformError } from '@effect/platform/Error';
import * as S from '@effect/schema/Schema';
import * as TF from '@effect/schema/TreeFormatter';
import * as KVS from '@effect/platform/KeyValueStore';
import {
	String,
	Context,
	Effect,
	Layer,
	Option,
	ReadonlyArray,
	flow,
	MutableHashSet,
	pipe,
} from 'effect';
import { AdId } from './ad';

export const KeyValueCFStore = Context.Tag<KVS.KeyValueStore>();

export const KVNamespace = Context.Tag<KVNamespace>();

export const KeyValueCFStoreLive = Layer.function(
	KVNamespace,
	KeyValueCFStore,
	(kv) =>
		KVS.make({
			get: (key) => Effect.promise(() => kv.get(key).then(Option.fromNullable)),
			set: (key, value) => Effect.promise(() => kv.put(key, value)),
			remove: (key) => Effect.promise(() => kv.delete(key)),
			clear: Effect.promise(() =>
				kv
					.list()
					.then((l) => Promise.all(l.keys.map((k) => kv.delete(k.name)))),
			),
			size: Effect.promise(() => kv.list().then((l) => l.keys.length)),
		}),
);

export const AdIdStorage = Context.Tag<AdIdStorage>();

export interface AdIdStorage {
	put(ids: readonly AdId[]): Effect.Effect<never, PlatformError, AdId[]>;
}

const SEP = ',';

export const newAdIdStorageLive = (scope: string) =>
	Effect.gen(function* (_) {
		const storeKey = `ad-storage--${scope}`;
		const store = yield* _(KeyValueCFStore);

		const set = yield* _(
			pipe(
				store.get(storeKey),
				Effect.flatMap(
					flow(
						Option.getOrElse(() => ''),
						String.split(SEP),
						ReadonlyArray.partitionMap((v) => S.parseEither(AdId)(v)),
						([es, rs]) =>
							pipe(
								es,
								ReadonlyArray.match({
									onEmpty: () => Effect.succeed<void>(undefined),
									onNonEmpty: (es) =>
										Effect.logWarning(
											`Failed to parse some IDs from storage ${storeKey}, ignoring:\n${pipe(
												es,
												ReadonlyArray.map((es) => TF.formatErrors(es.errors)),
												ReadonlyArray.join('\n\n'),
											)}`,
										),
								}),
								Effect.map(() => MutableHashSet.fromIterable(rs)),
							),
					),
				),
			),
		);

		const flush = () =>
			store.set(
				storeKey,
				pipe(set, ReadonlyArray.fromIterable, ReadonlyArray.join(',')),
			);

		return {
			put: (ids: readonly AdId[]) =>
				Effect.gen(function* (_) {
					yield* _(Effect.logDebug(`current storage set: ${set.toString()}`));

					const newAds = ReadonlyArray.filter(ids, (id) => {
						const alreadyKnown = MutableHashSet.has(set, id);

						MutableHashSet.add(set, id);

						return !alreadyKnown;
					});

					yield* _(flush());

					return newAds;
				}),
		};
	});
