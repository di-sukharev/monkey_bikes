import {
  standardSchemaValidators,
  type StandardSchemaV1,
} from '@tanstack/form-core'

export function createFormSchemaValidator(schema: StandardSchemaV1) {
  return ({ value }: { value: unknown }) => {
    return standardSchemaValidators.validate(
      {
        value,
        validationSource: 'form',
      },
      schema,
    )
  }
}

