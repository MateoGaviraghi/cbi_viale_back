import { ApiProperty } from '@nestjs/swagger'
import { IsObject } from 'class-validator'

export class UpdatePermissionsDto {
  @ApiProperty({
    description:
      'Reemplaza el objeto permissions completo. Keys válidas: manageAppointments, manageAvailability, manageSubmissions, manageUsers, viewAuditLog, exportData, viewAnalytics. Las keys fuera de esa whitelist tiran 400.',
    example: { manageAppointments: true, manageSubmissions: true, viewAuditLog: false },
  })
  @IsObject()
  permissions!: Record<string, boolean>
}
