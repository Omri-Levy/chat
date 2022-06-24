"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zParse = void 0;
const zod_1 = require("zod");
const zParse = async (schema, payload) => {
    try {
        const data = await schema.parseAsync(payload);
        return [data];
    }
    catch (err) {
        if (err instanceof zod_1.ZodError) {
            return [undefined, err.issues.map(({ message }) => message)];
        }
        throw err;
    }
};
exports.zParse = zParse;
