import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListSalariesQueryDto {
  @IsString()
  month!: string; // YYYY-MM

  @IsOptional()
  @IsEnum(['PAID', 'NOT_PAID', 'ALL'])
  status: 'PAID' | 'NOT_PAID' | 'ALL' = 'ALL';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize: number = 20;

  @IsOptional()
  @IsEnum(['default', 'revenue', 'salary_due', 'deductions', 'loans'])
  sort?: 'default' | 'revenue' | 'salary_due' | 'deductions' | 'loans';

  @IsOptional()
  @IsIn(['en', 'ar'])
  locale?: 'en' | 'ar';
}

export class CreateSalaryReceiptDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsEnum(['BANK_TRANSFER', 'CASH', 'OTHER'])
  paymentMethod!: 'BANK_TRANSFER' | 'CASH' | 'OTHER';

  @IsString()
  paymentDate!: string; // ISO date

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsEnum(['DEFERRAL_TO_NEXT_MONTH', 'ADMIN_EXEMPTION', 'MANUAL'])
  differenceProcessing?:
    | 'DEFERRAL_TO_NEXT_MONTH'
    | 'ADMIN_EXEMPTION'
    | 'MANUAL';

  @ValidateIf(
    (o: CreateSalaryReceiptDto) => o.differenceProcessing === 'MANUAL',
  )
  @IsString()
  differenceManualDetail?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
