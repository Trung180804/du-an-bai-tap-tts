import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { UnauthorizedException } from '@nestjs/common';
import { Model } from 'mongoose';
import { User } from 'src/users/user.schema';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  async register(email: string, pass: string) {
    const hashedPassword = await bcrypt.hash(pass, 10);
    const newUser = new this.userModel({ email, password: hashedPassword });
    return newUser.save();
  }

  async login(email: string, pass: string) {
    const user = await this.userModel.findOne({ email });
    if (user && (await bcrypt.compare(pass, user.password))) {
      const payload = { sub: user._id, email: user.email };
      return {
        access_token: await this.jwtService.signAsync(payload),
      };
      throw new UnauthorizedException('Email or password is false');
    }
  }

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user)
      throw new BadRequestException('Email do not exist!');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetToken = otp;
    await user.save();

    await this.mailerService.sendMail({
      to: email,
      subject: 'OTP Reset Password',
      html: `<b>OTP is: ${otp} <p>OTP is valid in 5 minutes</p>`,
    });

    return { message: '..........................!' };
  }

  /* 
  create(createAuthDto: CreateAuthDto) {
    return 'This action adds a new auth';
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
  */
}
