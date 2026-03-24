import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class AwsService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME')!;
    this.region = this.configService.get<string>('AWS_S3_REGION')!;
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
  }

  async uploadFile(file: Express.Multer.File, folderName: string = 'images') {
    try {
      const originalName = file.originalname.replace(/\s+/g, '-');
      const uniqueFileName = `${folderName}/${Date.now()}-${originalName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: uniqueFileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      });

      await this.s3Client.send(command);

      const fileUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${uniqueFileName}`;

      return {
        success: true,
        message: 'Upload to cloud successful!',
        url: fileUrl,
      };
    } catch (error) {
      console.error('[S3] Error upload file to AWS:', error);
      throw new InternalServerErrorException(`Error uploading file: ${error.message}`);
    }
  }
}