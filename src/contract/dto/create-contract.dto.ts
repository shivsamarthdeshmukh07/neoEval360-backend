import { IsNotEmpty, IsString, IsDateString, IsEnum } from 'class-validator';
import { ContractStatus } from '@prisma/client';

export class CreateContractDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsString()
  projectId: string;

  @IsNotEmpty()
  @IsDateString()
  contractStartDate: string;

  @IsNotEmpty()
  @IsDateString()
  contractEndDate: string;

  @IsEnum(ContractStatus)
  status: ContractStatus;
}
