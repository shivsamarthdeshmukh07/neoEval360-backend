import { IsString, IsArray, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { Role, EmployeeStatus } from '@prisma/client';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  experienceYears?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsString()
  parentSalesHeadId?: string;

  @IsOptional()
  @IsString()
  teamLeadId?: string;

  @IsOptional()
  @IsString()
  deliveryManagerId?: string;

  @IsOptional()
  @IsString()
  vicePresidentId?: string;
}
