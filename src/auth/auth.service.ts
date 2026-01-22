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
import { generateSecret, verify, generateURI } from "otplib";
import QRCode from "qrcode";

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
      });
      return await newUser.save();
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async login(email: string, pass: string) {
    const user = await this.userModel.findOne({ email });
    if (user && (await bcrypt.compare(pass, user.password))) {
      if (user.isTwoFactorAuthEnabled) {
        return {
          message: '2FA_REQUIRED',
          userId: user._id,
          requires2FA: true,
        };
      }

      const payload = {
        sub: user._id,
        isTwoFactorPending: true,
      };

      return {
        message: 'Please enter OTP code',
        twoFactorToken: await this.jwtService.signAsync(payload, { expiresIn: '5m' }),
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

  async generateTwoFactorAuthenticationSecret(user: User) {
    const secret = generateSecret();

    user.twoFactorAuthSecret = secret;
    await user.save();

    const uri = generateURI({
      issuer: "NWS",
      label: user.email,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(uri);

    return { qrDataUrl };
  }

  async pipeQrCodeStream(stream: Response, otpauthUrl: string) {
    return qrcode.toFileStream(stream, otpauthUrl);
  }

  async isTwoFactorAuthenticationCodeValid(
    twoFactorAuthCode: string,
    user: User,
  ) {
    return verify({
      token: twoFactorAuthCode,
      secret: user.twoFactorAuthSecret,
    });
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
