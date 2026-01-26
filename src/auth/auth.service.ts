import { UsersService } from '@/users/users.service';
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
import { ChangePasswordDto } from './dto/changePassword.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private mailerService: MailerService,
    private usersService: UsersService,
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
    const user = await this.usersService.findOneByEmailWithPassword(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      if (user.isTwoFactorAuthEnabled) {
        return {
          message: '2FA_REQUIRED',
          temporary_token: await this.jwtService.signAsync(
            { sub: user._id, email: user.email, isTwoFactorPending: true },
            { expiresIn: '5m' },
          ),
        };
      }
      return this.generateJwt(user);
    }
    throw new UnauthorizedException('Email or password is false');
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmailWithPassword(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user.toObject();
      return result;
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

  async setup2FA(userId: string) {
    const user = await this.userModel.findById(userId).select('+twoFactorAuthSecret');
    if (!user || !user.twoFactorAuthSecret) throw new BadRequestException('User not found');

    const { qrDataUrl } = await this.generateTwoFactorAuthenticationSecret(user);

    return qrDataUrl;
  }

  async enable2FA(userId: string, code: string) {
    const user = await this.userModel.findById(userId).select('+twoFactorAuthSecret');
    if (!user) throw new BadRequestException('User not found');

    if (!user.twoFactorAuthSecret) {
      throw new BadRequestException('Please setup 2FA first');
    }

    const isValid = verify({
      token: code,
      secret: user.twoFactorAuthSecret,
    });

    if (!isValid) {
      throw new BadRequestException('OTP is invalid');
    }

    user.isTwoFactorAuthEnabled = true;
    await user.save();

    return { message: '2FA enabled successfully' };
  }

  async verify2FA(userId: string, code: string) {
    const user = await this.userModel.findById(userId).select('+twoFactorAuthSecret');
    if (!user) throw new BadRequestException('User not found');

    const isValid = verify({
      token: code,
      secret: user.twoFactorAuthSecret,
    });

    if (!isValid) throw new BadRequestException('Invalid OTP');

    return this.generateJwt(user);
  }

  async disable2FA(userId: string, code: string) {
    const user = await this.userModel.findById(userId).select('+twoFactorAuthSecret');
    if (!user) throw new BadRequestException('User not found');
    if (!user.isTwoFactorAuthEnabled) throw new BadRequestException('2FA is not enabled');

    const isValid = verify({
      token: code,
      secret: user.twoFactorAuthSecret,
    });

    if (!isValid) throw new BadRequestException('Invalid OTP');

    user.isTwoFactorAuthEnabled = false;
    user.twoFactorAuthSecret = '';
    await user.save();
    return { message: '2FA disabled successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { oldPassword, newPassword, confirmNewPassword, twoFactorAuthenticationCode } = dto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('New password and confirmation do not match');
    }

    const user = await this.userModel.findById(userId).select('+password +twoFactorAuthSecret');
    if (!user) throw new BadRequestException('User not found');

    if (user.isTwoFactorAuthEnabled) {
      if (!twoFactorAuthenticationCode) {
        throw new BadRequestException('2FA code is required');
      }
      const isValid = verify({
        token: twoFactorAuthenticationCode,
        secret: user.twoFactorAuthSecret,
      });
      if (!isValid) throw new BadRequestException('Invalid 2FA code');
    }

    const isPasswordValid = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isPasswordValid) throw new BadRequestException('Old password is incorrect');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.newPassword, salt);
    await this.usersService.updatePassword(userId, hashedPassword);

    return { message: 'Password changed successfully' };
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
    const payload = {
      sub: user._id,
      email: user.email,
      isTwoFactorPending: false,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
