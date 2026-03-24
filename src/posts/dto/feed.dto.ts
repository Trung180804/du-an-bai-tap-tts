import { IsOptional, IsString } from 'class-validator';

export class FeedDto {
  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
