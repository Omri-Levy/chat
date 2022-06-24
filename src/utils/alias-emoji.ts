import emoji from 'node-emoji';

export const aliasEmoji = (str: string, ...args: any[]) => {
	let string = str;

	args.forEach(([pattern, alias]) => {
		string = string.replaceAll(pattern, `:${alias}:`);
	});

	return emoji.emojify(string);
};
