
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Assuming user is attached to request by Passport
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
