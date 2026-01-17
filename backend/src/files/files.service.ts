import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class FilesService {
  private readonly s3: S3Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.s3 = new S3Client({
      region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
      endpoint: this.config.get<string>('S3_ENDPOINT') || undefined,
      forcePathStyle: (this.config.get<string>('S3_FORCE_PATH_STYLE') ?? 'true') === 'true',
      credentials: this.config.get<string>('S3_ACCESS_KEY')
        ? {
            accessKeyId: this.config.get<string>('S3_ACCESS_KEY')!,
            secretAccessKey: this.config.get<string>('S3_SECRET_KEY')!,
          }
        : undefined,
    });
  }

  private bucket(): string {
    const b = this.config.get<string>('S3_BUCKET');
    if (!b) throw new Error('S3_BUCKET is required');
    return b;
  }

  private key(company_id: string, fileId: string, originalName: string): string {
    const safe = originalName.replace(/[^\w.\-() ]+/g, '_');
    return `${company_id}/${fileId}/${safe}`;
  }

  async createUploadUrl(input: {
    company_id: string;
    actor_user_id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    checksum?: string;
  }) {
    if (input.size_bytes <= 0 || input.size_bytes > Number(this.config.get<string>('FILES_MAX_BYTES') ?? 20 * 1024 * 1024)) {
      throw new BadRequestException('Invalid file size');
    }

    const file = await this.prisma.fileObject.create({
      data: {
        company_id: input.company_id,
        bucket: this.bucket(),
        object_key: 'PENDING',
        original_name: input.original_name,
        mime_type: input.mime_type,
        size_bytes: input.size_bytes,
        checksum: input.checksum ?? null,
        created_by_user_id: input.actor_user_id,
      },
      select: { id: true },
    });

    const object_key = this.key(input.company_id, file.id, input.original_name);
    await this.prisma.fileObject.update({
      where: { id: file.id },
      data: { object_key },
    });

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: object_key,
        ContentType: input.mime_type,
      }),
      { expiresIn: 60 * 10 },
    );

    await this.audit.log({
      company_id: input.company_id,
      actor_user_id: input.actor_user_id,
      action: 'FILES_UPLOAD_URL_CREATED',
      entity_type: 'FILE',
      entity_id: file.id,
      new_values: { original_name: input.original_name, mime_type: input.mime_type, size_bytes: input.size_bytes },
    });

    return { file_id: file.id, upload_url: uploadUrl };
  }

  async createDownloadUrl(input: { company_id: string; actor_user_id: string; file_id: string }) {
    const file = await this.prisma.fileObject.findFirst({
      where: { id: input.file_id, company_id: input.company_id, deleted_at: null },
    });
    if (!file) throw new NotFoundException();

    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: file.bucket,
        Key: file.object_key,
        ResponseContentDisposition: `attachment; filename="${file.original_name}"`,
      }),
      { expiresIn: 60 * 10 },
    );

    await this.audit.log({
      company_id: input.company_id,
      actor_user_id: input.actor_user_id,
      action: 'FILES_DOWNLOAD_URL_CREATED',
      entity_type: 'FILE',
      entity_id: file.id,
      new_values: { bucket: file.bucket, object_key: file.object_key },
    });

    return { download_url: url };
  }

  async linkToEntity(input: {
    company_id: string;
    actor_user_id: string;
    file_id: string;
    entity_type: string;
    entity_id: string;
    purpose_code: string;
  }) {
    const file = await this.prisma.fileObject.findFirst({
      where: { id: input.file_id, company_id: input.company_id, deleted_at: null },
      select: { id: true },
    });
    if (!file) throw new NotFoundException('File not found');

    const link = await this.prisma.fileLink.create({
      data: {
        company_id: input.company_id,
        file_id: input.file_id,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        purpose_code: input.purpose_code,
        created_by_user_id: input.actor_user_id,
      },
    });

    await this.audit.log({
      company_id: input.company_id,
      actor_user_id: input.actor_user_id,
      action: 'FILES_LINK_CREATED',
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      new_values: { file_id: input.file_id, purpose_code: input.purpose_code },
    });

    return link;
  }
}


