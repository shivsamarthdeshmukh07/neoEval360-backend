import { IsNotEmpty, IsString } from 'class-validator';

export class FeedbackDto {
  @IsNotEmpty()
  @IsString()
  feedback: string;
}
