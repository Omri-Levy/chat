const { z } = require(`zod`);
const { zField } = require(`./z-field`);

const roomSchema = zField(`Room`, 1, 120, `string`);
const usernameSchema = zField(`Username`, 1, 70, `string`);
const authSchema = z.object({
	room: roomSchema.schema,
	username: usernameSchema.schema,
});

module.exports = {
	roomSchema,
	usernameSchema,
	authSchema,
};
