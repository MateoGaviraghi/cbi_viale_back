import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches } from 'class-validator'

export class GetAvailabilityQueryDto {
  @ApiProperty({ example: '2026-05', description: 'Mes en formato YYYY-MM (local argentino)' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month debe tener formato YYYY-MM' })
  month!: string
}
