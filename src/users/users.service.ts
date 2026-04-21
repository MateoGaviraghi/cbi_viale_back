import { Injectable, NotFoundException } from '@nestjs/common'
import type { User, UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } })
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Usuario no encontrado')
    return user
  }

  async createUser(params: {
    name: string
    email: string
    password: string
    role?: UserRole
    permissions?: Record<string, boolean>
  }): Promise<User> {
    const passwordHash = await bcrypt.hash(params.password, 10)
    return this.prisma.user.create({
      data: {
        name: params.name,
        email: params.email,
        passwordHash,
        role: params.role ?? 'EMPLOYEE',
        permissions: params.permissions ?? {},
        active: true,
      },
    })
  }

  /** Valida password contra hash. No tira si user no existe (retorna false). */
  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email)
    if (!user || !user.passwordHash || !user.active) return null
    const ok = await bcrypt.compare(password, user.passwordHash)
    return ok ? user : null
  }
}
