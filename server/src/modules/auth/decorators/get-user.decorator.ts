import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '../../../database/entities/user.entity';

export const GetUser = createParamDecorator(
  (data: keyof UserEntity | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<{ user?: UserEntity }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
