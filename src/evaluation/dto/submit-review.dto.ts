import { IsNotEmpty, IsInt, Min, Max, IsString } from 'class-validator';

export class SubmitReviewDto {
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsNotEmpty()
  @IsString()
  feedback: string;
}
