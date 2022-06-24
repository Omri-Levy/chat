import { z } from 'zod';
import { zField } from './z-field';

export const roomSchema = zField(`Room`, 1, 70, `string`);
export const usernameSchema = zField(`Username`, 1, 70, `string`);
export const authSchema = z.object({
	room: roomSchema.schema,
	username: usernameSchema.schema,
});
