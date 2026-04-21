import { PartialType } from '@nestjs/swagger'
import { CreateBlockedDateDto } from './create-blocked-date.dto'

export class UpdateBlockedDateDto extends PartialType(CreateBlockedDateDto) {}
