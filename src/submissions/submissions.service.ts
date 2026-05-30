import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { FormSubmission, FormType } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { PaginatedResponse } from '../availability/availability.service'
import type { Env } from '../config/env.schema'
import { EmailsService } from '../emails/emails.service'
import { PrismaService } from '../prisma/prisma.service'
import { ServicesService } from '../services/services.service'
import { UploadsService } from '../uploads/uploads.service'
import type { CreateAgroFoodSubmissionDto } from './dto/create-agro-food-submission.dto'
import type { CreateClinicalSubmissionDto } from './dto/create-clinical-submission.dto'
import type { CreateEnvironmentalSubmissionDto } from './dto/create-environmental-submission.dto'
import type { CreateGeneticSubmissionDto } from './dto/create-genetic-submission.dto'
import type { CreateSubmissionDto } from './dto/create-submission.dto'
import type { CreateUrocultureSubmissionDto } from './dto/create-uroculture-submission.dto'
import type { CreateVaginalExudateSubmissionDto } from './dto/create-vaginal-exudate-submission.dto'
import type { CreateVeterinarySubmissionDto } from './dto/create-veterinary-submission.dto'
import type { SubmissionFiltersDto } from './dto/submission-filters.dto'
import type { UpdateSubmissionDto } from './dto/update-submission.dto'

/** JSON stringified máximo para extraData. Evita payloads abusivos. */
const MAX_EXTRA_DATA_BYTES = 10_000

/** Args internos del helper de persistencia + notificación. */
interface PersistAndNotifyArgs {
  type: FormType
  serviceSlug: string | null
  parentSubmissionId?: string
  name: string
  email: string
  phone: string | null
  subject?: string
  message: string
  consentGiven: boolean
  extraData: Record<string, unknown>
  /** Si presente + consentGiven=true, dispara la creación de un Consent ligado. */
  consent?: {
    signatureUrl?: string
    patientDni: string
    /** Fecha relevante del trámite (ej collectionDate). Null → PDF usa createdAt. */
    relevantDate?: Date | null
    ipAddress?: string | null
  }
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    private readonly emails: EmailsService,
    private readonly config: ConfigService<Env, true>,
    private readonly uploads: UploadsService,
  ) {}

  // ============================================================================
  //  Creación pública — formulario genérico legacy (CONTACT_GENERAL / SERVICE_INQUIRY / CONSENT / CUSTOM)
  // ============================================================================

  async create(dto: CreateSubmissionDto): Promise<FormSubmission> {
    if (dto.type === 'SERVICE_INQUIRY' && !dto.serviceSlug) {
      throw new BadRequestException('type SERVICE_INQUIRY requiere serviceSlug')
    }

    let serviceId: string | null = null
    let serviceName: string | null = null
    if (dto.serviceSlug) {
      const svc = await this.services.findBySlugOrThrow(dto.serviceSlug)
      serviceId = svc.id
      serviceName = svc.name
    }

    const extraData = dto.extraData ?? {}
    if (JSON.stringify(extraData).length > MAX_EXTRA_DATA_BYTES) {
      throw new BadRequestException('extraData excede el tamaño máximo (10KB stringified)')
    }

    const submission = await this.prisma.formSubmission.create({
      data: {
        type: dto.type,
        serviceId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        subject: dto.subject ?? null,
        message: dto.message,
        extraData: extraData as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    })

    await this.notifyOnCreate(submission, serviceName)
    return submission
  }

  // ============================================================================
  //  Formularios específicos por servicio
  // ============================================================================

  /** CLINICA_HUMANA — paciente humano con foto del pedido médico. */
  async createClinical(
    dto: CreateClinicalSubmissionDto,
    ipAddress?: string,
  ): Promise<FormSubmission> {
    this.assertConsent(dto.consentGiven)
    return this.persistAndNotify({
      type: 'CLINICAL',
      serviceSlug: 'clinica-humana',
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      message: this.buildMessage('Solicitud de análisis clínico', dto.observations),
      consentGiven: dto.consentGiven,
      extraData: {
        dni: dto.dni,
        birthDate: dto.birthDate.toISOString(),
        healthInsurance: dto.healthInsurance ?? null,
        requestingDoctor: dto.requestingDoctor ?? null,
        observations: dto.observations ?? null,
        medicalOrderUrl: dto.medicalOrderUrl,
      },
      consent: {
        signatureUrl: dto.signatureUrl,
        patientDni: dto.dni,
        relevantDate: null,
        ipAddress: ipAddress ?? null,
      },
    })
  }

  /** UROCULTURE — subform de Clínica Humana. */
  async createUroculture(
    dto: CreateUrocultureSubmissionDto,
    ipAddress?: string,
  ): Promise<FormSubmission> {
    this.assertConsent(dto.consentGiven)

    // Si tiene parent, validamos que exista y sea CLINICAL. Si no, requerimos email/phone.
    let parentEmail: string | null = null
    let parentPhone: string | null = null
    if (dto.parentSubmissionId) {
      const parent = await this.assertCanLinkToParent(dto.parentSubmissionId)
      parentEmail = parent.email
      parentPhone = parent.phone
    } else {
      if (!dto.email || !dto.phone) {
        throw new BadRequestException(
          'Sin parentSubmissionId, email y phone son obligatorios.',
        )
      }
    }

    return this.persistAndNotify({
      type: 'UROCULTURE',
      serviceSlug: 'clinica-humana',
      parentSubmissionId: dto.parentSubmissionId,
      name: dto.name,
      email: dto.email ?? parentEmail!,
      phone: dto.phone ?? parentPhone,
      message: 'Subformulario de urocultivo',
      consentGiven: dto.consentGiven,
      extraData: {
        dni: dto.dni,
        age: dto.age,
        collectionTime: dto.collectionTime,
        collectionDate: dto.collectionDate.toISOString(),
        sampleType: dto.sampleType ?? null,
        symptoms: dto.symptoms,
        pregnancy: dto.pregnancy ?? null,
        previousAntibiotics: dto.previousAntibiotics,
        baselinePathology: dto.baselinePathology,
      },
      consent: {
        signatureUrl: dto.signatureUrl,
        patientDni: dto.dni,
        relevantDate: dto.collectionDate,
        ipAddress: ipAddress ?? null,
      },
    })
  }

  /** VAGINAL_EXUDATE — subform de Clínica Humana. */
  async createVaginalExudate(
    dto: CreateVaginalExudateSubmissionDto,
    ipAddress?: string,
  ): Promise<FormSubmission> {
    this.assertConsent(dto.consentGiven)

    let parentName: string | null = null
    let parentEmail: string | null = null
    let parentPhone: string | null = null
    let parentDni: string | null = null
    if (dto.parentSubmissionId) {
      const parent = await this.assertCanLinkToParent(dto.parentSubmissionId)
      parentName = parent.name
      parentEmail = parent.email
      parentPhone = parent.phone
      const extra = parent.extraData as Record<string, unknown> | null
      parentDni = typeof extra?.dni === 'string' ? extra.dni : null
    } else {
      if (!dto.name || !dto.email || !dto.phone) {
        throw new BadRequestException(
          'Sin parentSubmissionId, name, email y phone son obligatorios.',
        )
      }
    }

    const finalName = dto.name ?? parentName!
    const finalEmail = dto.email ?? parentEmail!
    const finalPhone = dto.phone ?? parentPhone

    const finalDni = dto.dni ?? parentDni ?? null
    if (!finalDni) {
      throw new BadRequestException(
        'DNI obligatorio (no se pudo heredar del parent submission)',
      )
    }

    return this.persistAndNotify({
      type: 'VAGINAL_EXUDATE',
      serviceSlug: 'clinica-humana',
      parentSubmissionId: dto.parentSubmissionId,
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      message: 'Subformulario de exudado vaginal',
      consentGiven: dto.consentGiven,
      extraData: {
        dni: finalDni,
        age: dto.age,
        lastMenstruationDate: dto.lastMenstruationDate.toISOString(),
        symptoms: dto.symptoms,
        pregnancies: dto.pregnancies,
        flowCharacteristics: dto.flowCharacteristics,
        contraceptiveUse: dto.contraceptiveUse,
        vaginalInfectionHistory: dto.vaginalInfectionHistory,
        abortionCount: dto.abortionCount,
      },
      consent: {
        signatureUrl: dto.signatureUrl,
        patientDni: finalDni,
        relevantDate: null,
        ipAddress: ipAddress ?? null,
      },
    })
  }

  /** VETERINARY — análisis para animales. */
  async createVeterinary(dto: CreateVeterinarySubmissionDto): Promise<FormSubmission> {
    return this.persistAndNotify({
      type: 'VETERINARY',
      serviceSlug: 'veterinaria',
      name: dto.ownerName,
      email: dto.email,
      phone: dto.phone,
      message: this.buildMessage(
        `Análisis veterinario · ${dto.species} · ${dto.animalName}`,
        dto.observations,
      ),
      consentGiven: false,
      extraData: {
        dniOrCuit: dto.dniOrCuit,
        animalName: dto.animalName,
        species: dto.species,
        breed: dto.breed,
        animalAge: dto.animalAge,
        requestingVet: dto.requestingVet,
        sampleType: dto.sampleType,
        collectionDate: dto.collectionDate.toISOString(),
        observations: dto.observations ?? null,
      },
    })
  }

  /** AGRO_FOOD — productos alimenticios y materias primas. */
  async createAgroFood(dto: CreateAgroFoodSubmissionDto): Promise<FormSubmission> {
    return this.persistAndNotify({
      type: 'AGRO_FOOD',
      serviceSlug: 'agro-alimentos',
      name: dto.companyName,
      email: dto.email,
      phone: dto.phone,
      message: this.buildMessage(
        `Análisis ${dto.analysisType} · ${dto.productType}`,
        dto.observations,
      ),
      consentGiven: false,
      extraData: {
        cuit: dto.cuit,
        productType: dto.productType,
        batch: dto.batch ?? null,
        productionDate: dto.productionDate ? dto.productionDate.toISOString() : null,
        analysisType: dto.analysisType,
        sampleQuantity: dto.sampleQuantity,
        collectionDate: dto.collectionDate.toISOString(),
        origin: dto.origin ?? null,
        observations: dto.observations ?? null,
      },
    })
  }

  /** ENVIRONMENTAL — agua, efluentes, muestras ambientales. */
  async createEnvironmental(
    dto: CreateEnvironmentalSubmissionDto,
  ): Promise<FormSubmission> {
    return this.persistAndNotify({
      type: 'ENVIRONMENTAL',
      serviceSlug: 'ambiental',
      name: dto.companyName,
      email: dto.email,
      phone: dto.phone,
      message: this.buildMessage(
        `Análisis ${dto.analysisType} · ${dto.sampleType} · ${dto.location}`,
        dto.observations,
      ),
      consentGiven: false,
      extraData: {
        cuit: dto.cuit,
        sampleType: dto.sampleType,
        samplingPoint: dto.samplingPoint,
        location: dto.location,
        collectionDate: dto.collectionDate.toISOString(),
        collectionTime: dto.collectionTime ?? null,
        analysisType: dto.analysisType,
        samplingResponsible: dto.samplingResponsible ?? null,
        observations: dto.observations ?? null,
      },
    })
  }

  /** GENETIC — estudios genéticos. */
  async createGenetic(
    dto: CreateGeneticSubmissionDto,
    ipAddress?: string,
  ): Promise<FormSubmission> {
    this.assertConsent(dto.consentGiven)
    return this.persistAndNotify({
      type: 'GENETIC',
      serviceSlug: 'genetica',
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      message: this.buildMessage(
        `Estudio genético · ${dto.studyType}`,
        dto.observations,
      ),
      consentGiven: dto.consentGiven,
      extraData: {
        dni: dto.dni,
        studyType: dto.studyType,
        studyReason: dto.studyReason,
        sampleRelationship: dto.sampleRelationship ?? null,
        sampleCount: dto.sampleCount,
        collectionDate: dto.collectionDate.toISOString(),
        requestingProfessional: dto.requestingProfessional ?? null,
        observations: dto.observations ?? null,
        ethnicity: dto.ethnicity,
        diseaseStatus: dto.diseaseStatus ?? null,
        boneMarrowTransplant: dto.boneMarrowTransplant ?? null,
        studyDetail: dto.studyDetail,
        previousGeneticStudies: dto.previousGeneticStudies ?? null,
      },
      consent: {
        signatureUrl: dto.signatureUrl,
        patientDni: dto.dni,
        relevantDate: dto.collectionDate,
        ipAddress: ipAddress ?? null,
      },
    })
  }

  // ============================================================================
  //  Admin
  // ============================================================================

  async list(filters: SubmissionFiltersDto): Promise<PaginatedResponse<FormSubmission>> {
    const where: Prisma.FormSubmissionWhereInput = {}
    if (filters.type) where.type = filters.type
    if (filters.status) where.status = filters.status
    if (filters.serviceSlug) {
      const svc = await this.services.findBySlugOrThrow(filters.serviceSlug)
      where.serviceId = svc.id
    }
    if (filters.dateFrom || filters.dateTo) {
      const range: Prisma.DateTimeFilter = {}
      if (filters.dateFrom) range.gte = filters.dateFrom
      if (filters.dateTo) range.lte = filters.dateTo
      where.createdAt = range
    }
    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
        { subject: { contains: filters.q, mode: 'insensitive' } },
        { message: { contains: filters.q, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: { service: { select: { id: true, slug: true, name: true } } },
      }),
      this.prisma.formSubmission.count({ where }),
    ])

    return {
      data: items,
      meta: {
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      },
    }
  }

  async getByIdOrThrow(id: string) {
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id },
      include: {
        service: true,
        children: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!submission) throw new NotFoundException('Consulta no encontrada')
    return submission
  }

  async update(
    id: string,
    dto: UpdateSubmissionDto,
    userId: string,
  ): Promise<FormSubmission> {
    const existing = await this.prisma.formSubmission.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Consulta no encontrada')

    if (dto.status === undefined) return existing

    const data: Prisma.FormSubmissionUpdateInput = { status: dto.status }
    if (dto.status === 'ANSWERED' && existing.status !== 'ANSWERED') {
      data.answeredAt = new Date()
      data.answeredBy = userId
    }

    const updated = await this.prisma.formSubmission.update({ where: { id }, data })
    await this.audit(userId, 'SUBMISSION_PATCH', 'FormSubmission', id, {
      fromStatus: existing.status,
      toStatus: dto.status,
    })
    return updated
  }

  // ============================================================================
  //  Helpers privados
  // ============================================================================

  private assertConsent(consent: boolean): void {
    if (!consent) {
      throw new BadRequestException('Debe aceptar el consentimiento para continuar.')
    }
  }

  /**
   * Valida que el parentSubmissionId apunte a un FormSubmission existente y de
   * tipo CLINICAL. Devuelve el padre para poder heredar email/phone/dni.
   */
  private async assertCanLinkToParent(parentId: string): Promise<FormSubmission> {
    const parent = await this.prisma.formSubmission.findUnique({ where: { id: parentId } })
    if (!parent) {
      throw new BadRequestException('parentSubmissionId no encontrado.')
    }
    if (parent.type !== 'CLINICAL') {
      throw new BadRequestException(
        'parentSubmissionId debe referenciar un formulario CLINICAL.',
      )
    }
    return parent
  }

  private buildMessage(headline: string, observations?: string | null): string {
    if (observations && observations.trim().length > 0) {
      return `${headline}\n\nObservaciones: ${observations.trim()}`
    }
    return headline
  }

  private async persistAndNotify(args: PersistAndNotifyArgs): Promise<FormSubmission> {
    if (JSON.stringify(args.extraData).length > MAX_EXTRA_DATA_BYTES) {
      throw new BadRequestException('extraData excede el tamaño máximo (10KB stringified)')
    }

    // Validación de firma fuera de la transacción para fallar rápido.
    if (
      args.consent?.signatureUrl &&
      !this.uploads.isOwnCloudinaryUrl(args.consent.signatureUrl)
    ) {
      throw new BadRequestException(
        'signatureUrl debe pertenecer al cloud propio. Subila vía POST /uploads/signature/sign.',
      )
    }

    let serviceId: string | null = null
    let serviceName: string | null = null
    let serviceSlugResolved: string | null = null
    if (args.serviceSlug) {
      const svc = await this.services.findBySlugOrThrow(args.serviceSlug)
      serviceId = svc.id
      serviceName = svc.name
      serviceSlugResolved = svc.slug
    }

    // Atomizamos creación de FormSubmission + Consent para no quedar inconsistentes.
    const submission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.formSubmission.create({
        data: {
          type: args.type,
          serviceId,
          parentSubmissionId: args.parentSubmissionId ?? null,
          name: args.name,
          email: args.email,
          phone: args.phone,
          subject: args.subject ?? null,
          message: args.message,
          consentGiven: args.consentGiven,
          extraData: args.extraData as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      })

      if (args.consentGiven && args.consent && serviceName && serviceSlugResolved) {
        await tx.consent.create({
          data: {
            formSubmissionId: created.id,
            patientName: args.name,
            patientDni: args.consent.patientDni,
            serviceName,
            serviceSlug: serviceSlugResolved,
            appointmentDate: args.consent.relevantDate ?? null,
            consentGivenAt: new Date(),
            ipAddress: args.consent.ipAddress ?? null,
            patientSignatureUrl: args.consent.signatureUrl ?? null,
            professionalSignatureUrl:
              this.config.get('PROFESSIONAL_SIGNATURE_URL', { infer: true }) || null,
            professionalName: this.config.get('PROFESSIONAL_NAME', { infer: true }),
            professionalRole: this.config.get('PROFESSIONAL_ROLE', { infer: true }),
          },
        })
      }

      return created
    })

    await this.notifyOnCreate(submission, serviceName)
    return submission
  }

  /** Encola FORM_RECEIPT al usuario y INTERNAL_NOTIFICATION al staff. */
  private async notifyOnCreate(
    submission: FormSubmission,
    serviceName: string | null,
  ): Promise<void> {
    await this.emails.enqueue({
      kind: 'FORM_RECEIPT',
      to: submission.email,
      subject: `Recibimos tu consulta · CBI Viale`,
      payload: {
        name: submission.name,
        subject: submission.subject,
        message: submission.message,
        serviceName,
      },
    })

    const businessEmail = this.config.get('BUSINESS_NOTIFICATION_EMAIL', { infer: true })
    if (businessEmail) {
      await this.emails.enqueue({
        kind: 'INTERNAL_NOTIFICATION',
        to: businessEmail,
        subject: `Nueva consulta — ${humanFormType(submission.type)}${serviceName ? ` · ${serviceName}` : ''}`,
        payload: {
          variant: 'submission',
          formType: humanFormType(submission.type),
          name: submission.name,
          email: submission.email,
          phone: submission.phone,
          subject: submission.subject,
          message: submission.message,
          serviceName,
        },
      })
    }
  }

  private async audit(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { userId, action, entity, entityId, metadata: metadata as Prisma.InputJsonValue },
    })
  }
}

/** Traduce el enum FormType a texto legible (usado en subject y body de emails). */
function humanFormType(type: FormType): string {
  switch (type) {
    case 'CONTACT_GENERAL':
      return 'Contacto general'
    case 'SERVICE_INQUIRY':
      return 'Consulta por servicio'
    case 'CONSENT':
      return 'Consentimiento'
    case 'CUSTOM':
      return 'Personalizado'
    case 'CLINICAL':
      return 'Clínica humana'
    case 'UROCULTURE':
      return 'Urocultivo'
    case 'VAGINAL_EXUDATE':
      return 'Exudado vaginal'
    case 'VETERINARY':
      return 'Veterinaria'
    case 'AGRO_FOOD':
      return 'Agro y alimentos'
    case 'ENVIRONMENTAL':
      return 'Ambiental'
    case 'GENETIC':
      return 'Genética'
  }
}
