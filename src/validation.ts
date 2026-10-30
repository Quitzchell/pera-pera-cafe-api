import { ValidateIf } from 'class-validator'

// Like @IsOptional(), but only for a missing field: null is still validated and rejected, so it
// cannot reach a NOT NULL column as a 500.
export const IsOmittable = () => ValidateIf((_object, value) => value !== undefined)
