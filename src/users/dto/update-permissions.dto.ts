import { ApiProperty } from '@nestjs/swagger'
import { IsObject, registerDecorator, type ValidationOptions } from 'class-validator'

/**
 * Valida que TODOS los valores del objeto sean boolean. Sin esto, un payload
 * como `{ manageUsers: 'yes' }` pasaba el `@IsObject()` suelto y se persistía un
 * permiso con valor string (hueco de integridad — el guard compara `=== true`).
 */
function IsBooleanMap(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBooleanMap',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return false
          }
          return Object.values(value as Record<string, unknown>).every(
            (v) => typeof v === 'boolean',
          )
        },
        defaultMessage(): string {
          return 'permissions debe ser un objeto con valores booleanos'
        },
      },
    })
  }
}

export class UpdatePermissionsDto {
  @ApiProperty({
    description:
      'Reemplaza el objeto permissions completo. Keys válidas: manageAppointments, manageAvailability, manageSubmissions, manageUsers, viewAuditLog, exportData, viewAnalytics. Las keys fuera de esa whitelist tiran 400. Los valores deben ser booleanos.',
    example: { manageAppointments: true, manageSubmissions: true, viewAuditLog: false },
  })
  @IsObject()
  @IsBooleanMap()
  permissions!: Record<string, boolean>
}
