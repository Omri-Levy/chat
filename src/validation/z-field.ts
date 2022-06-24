import { z } from 'zod';

export const zField = (
	field: string,
	min: number,
	max: number,
	type: `string` | `number`
) => {
	// Gives access to consistent validation messages using the field's name and values,
	class ZField {
		// Allows accessing the validation message of a field or the validation values based on a flag, without changing the property names.
		// i.e ValidationMessage.min (message) | ValidationMessage.value.min (value)
		value = {
			field,
			min,
			max,
			type,
		};
		min = `${this.value.field} must contain at least ${this.value.min} character(s)`;
		max = `${this.value.field} must contain at most ${this.value.max} character(s)`;
		required = `${this.value.field} is required`;
		type = `${this.value.field} must be a ${this.value.type}`;

		get schema() {
			return z[this.value.type]({
				required_error: this.required,
				invalid_type_error: this.type,
			})
				.min(this.value.min, this.min)
				.max(this.value.max, this.max);
		}

		doesNotExist(which: string) {
			return `${this.value.field} "${which}" does not exist`;
		}

		alreadyExists(which: string) {
			return `${this.value.field} "${which}" already exists`;
		}
	}

	return new ZField();
};
