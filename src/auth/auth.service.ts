import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // 1. Đăng nhập
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);

    // Sinh cặp Access Token & Refresh Token
    const tokens = await this.generateTokens(user.id, user.email, roles);

    // Lưu hash của refreshToken vào DB
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Đăng nhập thành công',
      ...tokens,
    };
  }

  // 2. Làm mới Access Token bằng Refresh Token
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token không được để trống');
    }

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'default_refresh_secret';

    let payload: { sub: number; email: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user || !user.refreshToken || !user.isActive) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }

    // So sánh refresh token gửi lên với hash lưu trong DB
    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);

    // Cấp cặp token mới (Token Rotation)
    const newTokens = await this.generateTokens(user.id, user.email, roles);

    // Cập nhật lại hash refresh token mới vào DB
    await this.updateRefreshToken(user.id, newTokens.refreshToken);

    return {
      message: 'Làm mới token thành công',
      ...newTokens,
    };
  }

  // 3. Đăng xuất
  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return {
      success: true,
      message: 'Đăng xuất thành công',
    };
  }

  // Helper: Sinh cặp Token
  private async generateTokens(userId: number, email: string, roles: string[]) {
    const payload = { sub: userId, email, roles };

    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'default_access_secret';
    const accessExpiresIn = (this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
    ) || '15m') as JwtSignOptions['expiresIn'];

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'default_refresh_secret';
    const refreshExpiresIn = (this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) || '7d') as JwtSignOptions['expiresIn'];

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: refreshSecret,
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  // Helper: Lưu hash của refreshToken vào database
  private async updateRefreshToken(userId: number, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });
  }
}
