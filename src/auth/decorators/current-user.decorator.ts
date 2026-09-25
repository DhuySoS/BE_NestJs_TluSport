import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../interfaces/auth-user.interface.js';

export const CurrentUser = createParamDecorator(
  <K extends keyof AuthUser>(
    data: K | undefined,
    ctx: ExecutionContext,
  ): AuthUser | AuthUser[K] | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    return data && user ? user[data] : user;
  },
);
