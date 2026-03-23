import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AwsService } from "./aws.service";

@Controller('aws')
export class AwsController {
  constructor(private readonly awsService: AwsService) {}
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.awsService.uploadFile(file, 'test-aws');
  }
}
