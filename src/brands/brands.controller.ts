import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BrandsService } from './brands.service.js';
import { CreateBrandDto } from './dto/create-brand.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandService: BrandsService) {}

  // 1. Tạo thương hiệu (Yêu cầu đăng nhập + Role: ADMIN hoặc STAFF)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROLE_ADMIN', 'ROLE_STAFF')
  create(@Body() createBrandDto: CreateBrandDto) {
    return this.brandService.create(createBrandDto);
  }

  // 2. Lấy danh sách thương hiệu (Public - ai cũng xem được)
  @Get()
  getAll() {
    return this.brandService.getAll();
  }
}
