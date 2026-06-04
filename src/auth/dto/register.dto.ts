import { IsEmail, IsNotEmpty, IsEnum, IsString, IsArray, IsOptional, IsNumber, Min } from 'class-validator';
import { Role, EmployeeStatus } from '@prisma/client';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  designation: string;

  @IsNotEmpty()
  @IsString()
  department: string;

  @IsNotEmpty()
  @IsString()
  joiningDate: string;

  @IsEnum(Role)
  role: Role;

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
