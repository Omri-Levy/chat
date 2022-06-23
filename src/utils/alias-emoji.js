const emoji = require(`node-emoji`);

const aliasEmoji = (str, ...args) => {
	let string = str;

	args.forEach(([pattern, alias]) => {
		string = string.replaceAll(pattern, `:${alias}:`);
	});

	return emoji.emojify(string);
};

module.exports = {
	aliasEmoji,
};
