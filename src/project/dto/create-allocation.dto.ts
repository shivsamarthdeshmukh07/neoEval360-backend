import { IsNotEmpty, IsString, IsInt, Min, Max, IsDateString } from 'class-validator';

export class CreateAllocationDto {
  @IsNotEmpty()
  @IsString()
  developerId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(100)
  allocationPercentage: number;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}
