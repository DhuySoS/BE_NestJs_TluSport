import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBrandDto } from './dto/create-brand.dto.js';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Tạo thương hiệu mới (Admin/Staff)
  async create(createBrandDto: CreateBrandDto) {
    const existingBrand = await this.prisma.brand.findUnique({
      where: { slug: createBrandDto.slug },
    });

    if (existingBrand) {
      throw new ConflictException(
        `Thương hiệu với slug "${createBrandDto.slug}" đã tồn tại.`,
      );
    }

    const brand = await this.prisma.brand.create({
      data: createBrandDto,
    });

    return {
      message: 'Tạo thương hiệu thành công',
      data: brand,
    };
  }

  // 2. Lấy toàn bộ danh sách thương hiệu đang hoạt động (Public)
  async getAll() {
    const brands = await this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { products: true }, // Đếm tổng số sản phẩm thuộc thương hiệu này
        },
      },
    });

    return {
      message: 'Lấy danh sách thương hiệu thành công',
      total: brands.length,
      data: brands,
    };
  }
}
