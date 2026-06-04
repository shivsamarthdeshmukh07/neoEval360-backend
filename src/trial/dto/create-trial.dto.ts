import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class CreateTrialDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsString()
  projectId: string;

  @IsNotEmpty()
  @IsDateString()
  trialStartDate: string;

  @IsNotEmpty()
  @IsDateString()
  trialEndDate: string;
}
