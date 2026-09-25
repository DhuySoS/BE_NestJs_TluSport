import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchProductsDto, ProductSortBy } from './dto/search-products.dto.js';
import { Prisma } from '../generated/prisma/client.js';

// 1. Cấu hình Include chuẩn dùng chung cho tất cả các query lấy Product
export const PRODUCT_DEFAULT_INCLUDE = {
  category: {
    select: { id: true, name: true, slug: true },
  },
  brand: {
    select: { id: true, name: true, slug: true, logoUrl: true },
  },
  images: {
    orderBy: { displayOrder: 'asc' as const },
  },
  skus: {
    where: { isActive: true },
    select: {
      id: true,
      skuCode: true,
      price: true,
      stockQuantity: true,
    },
  },
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // 🛠️ HÀM NỘI BỘ DÙNG CHUNG: Xử lý query dữ liệu kèm phân trang
  private async paginateProducts(options: {
    where?: Prisma.ProductWhereInput;
    orderBy?: Prisma.ProductOrderByWithRelationInput;
    page?: number;
    limit?: number;
    message?: string;
  }) {
    const {
      where = { isActive: true },
      orderBy = { createdAt: 'desc' },
      page = 1,
      limit = 10,
      message = 'Lấy danh sách sản phẩm thành công',
    } = options;

    const skip = (page - 1) * limit;

    // Chạy song song: đếm tổng số lượng và lấy danh sách bản ghi
    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: PRODUCT_DEFAULT_INCLUDE,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message,
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // 1. API Tìm kiếm & Lọc sản phẩm nâng cao
  async search(query: SearchProductsDto) {
    const {
      keyword,
      categoryId,
      brandId,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sortBy = ProductSortBy.NEWEST,
    } = query;

    // Xây dựng điều kiện lọc
    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (keyword && keyword.trim() !== '') {
      where.OR = [
        { name: { contains: keyword.trim(), mode: 'insensitive' } },
        { description: { contains: keyword.trim(), mode: 'insensitive' } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {};
      if (minPrice !== undefined) {
        where.basePrice.gte = new Prisma.Decimal(minPrice);
      }
      if (maxPrice !== undefined) {
        where.basePrice.lte = new Prisma.Decimal(maxPrice);
      }
    }

    // Xây dựng điều kiện sắp xếp
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    switch (sortBy) {
      case ProductSortBy.PRICE_ASC:
        orderBy = { basePrice: 'asc' };
        break;
      case ProductSortBy.PRICE_DESC:
        orderBy = { basePrice: 'desc' };
        break;
      case ProductSortBy.OLDEST:
        orderBy = { createdAt: 'asc' };
        break;
      case ProductSortBy.NEWEST:
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Gọi hàm dùng chung
    return this.paginateProducts({
      where,
      orderBy,
      page,
      limit,
      message: 'Tìm kiếm sản phẩm thành công',
    });
  }

  // 2. API Lấy tất cả sản phẩm (Có phân trang)
  async getAllProducts(page: number = 1, limit: number = 10) {
    return this.paginateProducts({
      where: { isActive: true },
      page,
      limit,
      message: 'Lấy tất cả sản phẩm thành công',
    });
  }

  // 3. API Lấy chi tiết 1 sản phẩm theo ID (Tái sử dụng PRODUCT_DEFAULT_INCLUDE)
  async getProductById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_DEFAULT_INCLUDE,
    });

    if (!product || !product.isActive) {
      throw new NotFoundException(`Không tìm thấy sản phẩm #${id}`);
    }

    return {
      success: true,
      message: 'Lấy chi tiết sản phẩm thành công',
      data: product,
    };
  }
}
