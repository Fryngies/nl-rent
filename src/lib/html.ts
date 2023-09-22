import { parse as _parse } from 'node-html-parser';
import { Either } from 'effect';

export class HtmlParseError extends Error {
	readonly _tag = 'HtmlParseError';
	constructor(readonly string: string, readonly reason: unknown) {
		super('HtmlParseError');
	}
}

export const parseHtml = (s: string) =>
	Either.try({
		try: () => _parse(s),
		catch: (e: unknown) => new HtmlParseError(s, e),
	});
