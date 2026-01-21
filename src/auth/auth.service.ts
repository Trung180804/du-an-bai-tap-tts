import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { UnauthorizedException } from '@nestjs/common';
import { Model } from 'mongoose';
import { User } from 'src/users/user.schema';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as qrcode from 'qrcode';
import { Response } from 'express';
import * as otplibModule from 'otplib';
const authenticator = (otplibModule as any).authenticator;
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  async register(email: string, pass: string) {
    try {
      const existingUser = await this.userModel.findOne({ email });
      if (existingUser) {
        throw new BadRequestException('Email already exists');
      }

      const hashedPassword = await bcrypt.hash(pass, 10);

      const newUser = new this.userModel({
        email,
        password: hashedPassword,
        isTwoFactorAuthEnabled: false,
        twoFactorAuthSecret: null 
      });
      return await newUser.save();
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async login(email: string, pass: string) {
    const user = await this.userModel.findOne({ email });
    if (user && (await bcrypt.compare(pass, user.password))) {
      const payload = { sub: user._id, email: user.email };
      return {
        access_token: await this.jwtService.signAsync(payload),
      };
    }
    throw new UnauthorizedException('Email or password is false');
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.userModel.findOne({ email });
    if (user && (await bcrypt.compare(pass, user.password))) {
      return user;
    }
    return null;
  }

  async GenerateTwoFactorAuthenticationSecret(user: User) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.email,
      'NWS',
      secret,
    );

    user.twoFactorAuthSecret = secret;
    await user.save();
    return { secret, otpauthUrl };
  }

  async pipeQrCodeStream(stream: Response, otpauthUrl: string) {
    return qrcode.toFileStream(stream, otpauthUrl);
  }

  async isTwoFactorAuthenticationCodeValid(twoFactorAuthCode: string, user: User) {
    return authenticator.verify(twoFactorAuthCode, user.twoFactorAuthSecret);
  }

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) throw new BadRequestException('Email do not exist!');

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

  generateJwt(user: User) {
    const payload = { sub: user._id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
