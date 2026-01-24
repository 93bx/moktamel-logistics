import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
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
}

