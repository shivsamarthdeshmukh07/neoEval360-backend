import { IsNotEmpty, IsString, IsEnum, IsDateString } from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  clientId: string;

  @IsNotEmpty()
  @IsString()
  salesOwnerId: string;

  @IsNotEmpty()
  @IsString()
  deliveryManagerId: string;

  @IsNotEmpty()
  @IsString()
  teamLeadId: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsNotEmpty()
  @IsDateString()
  contractStartDate: string;

  @IsNotEmpty()
  @IsDateString()
  contractEndDate: string;

  @IsEnum(ProjectStatus)
  status: ProjectStatus;
}
