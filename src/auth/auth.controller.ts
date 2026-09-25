import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';

import type { AuthUser } from './interfaces/auth-user.interface.js';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true, // Chống XSS (JS frontend không đọc trộm được)
  secure: process.env.NODE_ENV === 'production', // Bật HTTPS trên production
  sameSite: 'lax' as const, // Chống tấn công CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
  path: '/', // Áp dụng toàn trang
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 1. Đăng nhập -> Gắn Refresh Token vào HttpOnly Cookie, trả Access Token qua JSON
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // Lưu Refresh Token vào HttpOnly Cookie
    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      REFRESH_COOKIE_OPTIONS,
    );

    // Trả về Access Token qua response body
    return {
      message: result.message,
      accessToken: result.accessToken,
    };
  }

  // 2. Làm mới Access Token -> Lấy Refresh Token từ Cookie (hoặc Body)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: Request,
    @Body() body: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Ưu tiên đọc từ HttpOnly Cookie, fallback sang Body (nếu test qua Postman)
    const token = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException(
        'Không tìm thấy Refresh token trong Cookie hoặc Body',
      );
    }

    const newTokens = await this.authService.refreshToken({
      refreshToken: token,
    });

    // Cập nhật lại Refresh Token mới vào Cookie (Token Rotation)
    res.cookie(
      REFRESH_COOKIE_NAME,
      newTokens.refreshToken,
      REFRESH_COOKIE_OPTIONS,
    );

    return {
      message: newTokens.message,
      accessToken: newTokens.accessToken,
    };
  }

  // 3. Đăng xuất -> Thu hồi Refresh Token trong DB và Xóa Cookie
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(userId);

    // Xóa cookie phía client
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });

    return {
      success: true,
      message: 'Đăng xuất thành công',
    };
  }

  // 4. Lấy thông tin tài khoản đang đăng nhập (Protected)
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: AuthUser) {
    return {
      message: 'Lấy thông tin tài khoản thành công',
      user,
    };
  }

  // 5. Endpoint demo phân quyền ADMIN
  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROLE_ADMIN')
  adminOnly(@CurrentUser() user: AuthUser) {
    return {
      message: 'Xin chào Admin! Bạn có quyền truy cập endpoint này.',
      user,
    };
  }
}
