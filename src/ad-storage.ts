import { PlatformError } from '@effect/platform/Error';
import { Schema } from '@effect/schema';
import * as TF from '@effect/schema/TreeFormatter';
import * as KVS from '@effect/platform/KeyValueStore';
import {
	String,
	Context,
	Effect,
	Layer,
	Option,
	flow,
	MutableHashSet,
	pipe,
	Array,
} from 'effect';
import { AdId } from './ad';

export class KVNamespaceTag extends Context.Tag('KVNamespace')<
	KVNamespaceTag,
	KVNamespace
>() {}

export class KeyValueCFStore extends Context.Tag('KeyValueCFStore')<
	KeyValueCFStore,
	KVS.KeyValueStore
>() {}

export const KeyValueCFStoreLive = Layer.function(
	KVNamespaceTag,
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

export class AdIdStorage extends Context.Tag('AdIdStorage')<
	AdIdStorage,
	{
		put(ids: readonly AdId[]): Effect.Effect<AdId[], PlatformError>;
	}
>() {}

const SEP = ',';

export const newAdIdStorageLive = (scope: string) =>
	Effect.gen(function* () {
		const storeKey = `ad-storage--${scope}`;
		const store = yield* KeyValueCFStore;

		const set = yield* pipe(
			store.get(storeKey),
			Effect.flatMap(
				flow(
					Option.getOrElse(() => ''),
					String.split(SEP),
					Array.partitionMap((v) => Schema.decodeEither(AdId)(v)),
					([es, rs]) =>
						pipe(
							es,
							Array.match({
								onEmpty: () => Effect.succeed<void>(undefined),
								onNonEmpty: (es) =>
									Effect.logWarning(
										`Failed to parse some IDs from storage ${storeKey}, ignoring:\n${pipe(
											es,
											Array.map(TF.formatErrorSync),
											Array.join('\n\n'),
										)}`,
									),
							}),
							Effect.map(() => MutableHashSet.fromIterable(rs)),
						),
				),
			),
		);
		const flush = () =>
			store.set(storeKey, pipe(set, Array.fromIterable, Array.join(',')));

		return {
			put: (ids: readonly AdId[]) =>
				Effect.gen(function* (_) {
					yield* _(Effect.logDebug(`current storage set: ${set.toString()}`));

					const newAds = Array.filter(ids, (id) => {
						const alreadyKnown = MutableHashSet.has(set, id);

						MutableHashSet.add(set, id);

						return !alreadyKnown;
					});

					yield* _(flush());

					return newAds;
				}),
		};
	});
