import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import jwtConfig from '../../config/jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(jwtConfig.KEY)
    private config: ConfigType<typeof jwtConfig>,
  ) {
    super({
      jwtFromRequest: (req) => {
        let token = null;
        if (req && req.cookies) {
          token = req.cookies['accessToken'];
        }
        return token || ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      ignoreExpiration: false,
      secretOrKey: config.secret,
    });
  }

  validate(payload: { sub: string; email: string; role: string }) {
    // Return the user object attached to the request
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
