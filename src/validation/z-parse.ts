import { ZodError, ZodSchema } from 'zod';

export const zParse = async (schema: ZodSchema, payload: unknown) => {
	try {
		const data = await schema.parseAsync(payload);

		return [data];
	} catch (err) {
		if (err instanceof ZodError) {
			return [undefined, err.issues.map(({ message }) => message)];
		}

		throw err;
	}
};
