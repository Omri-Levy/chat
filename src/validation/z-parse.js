const zParse = async (schema, payload) => {
	const { data, error } = await schema.safeParseAsync(payload);
	const errors = error
		? error.issues.map(({ path, message }) => message)
		: undefined;

	return [data, errors];
};

module.exports = {
	zParse,
};
