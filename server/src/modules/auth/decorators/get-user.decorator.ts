import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '../../../database/entities/user.entity';

export const GetUser = createParamDecorator(
  (data: keyof UserEntity, ctx: ExecutionContext): UserEntity | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);