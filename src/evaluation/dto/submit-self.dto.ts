import { IsNotEmpty, IsInt, Min, Max, IsString } from 'class-validator';

export class SubmitSelfDto {
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  selfRating: number;

  @IsNotEmpty()
  @IsString()
  selfFeedback: string;
}
