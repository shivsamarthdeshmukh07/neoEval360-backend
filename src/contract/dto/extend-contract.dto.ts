import { IsNotEmpty, IsDateString } from 'class-validator';

export class ExtendContractDto {
  @IsNotEmpty()
  @IsDateString()
  newEndDate: string;
}
