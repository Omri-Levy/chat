"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authSchema = exports.usernameSchema = exports.roomSchema = void 0;
const zod_1 = require("zod");
const z_field_1 = require("./z-field");
exports.roomSchema = (0, z_field_1.zField)(`Room`, 1, 70, `string`);
exports.usernameSchema = (0, z_field_1.zField)(`Username`, 1, 70, `string`);
exports.authSchema = zod_1.z.object({
    room: exports.roomSchema.schema,
    username: exports.usernameSchema.schema,
});
