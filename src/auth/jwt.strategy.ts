import { IsNotEmpty } from 'class-validator';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: any) {
    if (payload.isTwoFactorPending) {
      return {
        userId: payload.sub,
        email: payload.email,
        isTwoFactorPending: true,
      };
    }
    return { userId: payload.sub, email: payload.email, isTwoFactorPending: false };
  }
}
