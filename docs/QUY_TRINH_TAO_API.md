# HƯỚNG DẪN QUY TRÌNH XÂY DỰNG API TRONG NESTJS + PRISMA

Tài liệu này hướng dẫn chi tiết quy trình chuẩn từ A - Z để xây dựng một API trong dự án backend `be-nest-tlusport`.

---

## 1. Kiến Trúc Luồng Xử Lý (Request Lifecycle)

Mỗi Request khi gửi từ Client (Postman/Frontend) sẽ đi qua các lớp theo thứ tự:

```
[Client] (Postman/React/Vue)
   │
   ▼ HTTP Request (GET/POST/PUT/DELETE) kèm Query / Body / Params
[Controller] (products.controller.ts)
   │  - Định nghĩa endpoint URL (@Get, @Post,...)
   │  - Validate dữ liệu đầu vào thông qua DTO (ValidationPipe)
   ▼
[Service] (products.service.ts)
   │  - Xử lý Business Logic nghiệp vụ
   │  - Tạo câu lệnh query
   ▼
[PrismaService] (prisma.service.ts)
   │  - Tương tác với PostgreSQL Database
   ▼
[PostgreSQL Database]
```

---

## 2. Quy Trình Chuẩn 5 Bước Tạo Một API Mới

### Bước 1: Kiểm tra hoặc Cập nhật Model trong `prisma/schema.prisma`
1. Mở file `prisma/schema.prisma` để kiểm tra bảng và các trường dữ liệu.
2. Nếu thêm hoặc sửa bảng, chạy lệnh đồng bộ vào PostgreSQL:
   ```bash
   npx prisma db push --accept-data-loss
   npx prisma generate
   ```

---

### Bước 2: Tạo DTO (Data Transfer Object) để nhận và Validate dữ liệu
> 📁 Vị trí: `src/<ten-module>/dto/`

DTO giúp kiểm tra chặt chẽ dữ liệu client gửi lên (bắt buộc, tùy chọn, kiểu số, chuỗi, email, khoảng giá,...).

**Ví dụ: DTO Tìm kiếm và Phân trang sản phẩm (`src/products/dto/search-products.dto.ts`)**
```typescript
import { IsOptional, IsString, IsNumber, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductSortBy {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NEWEST = 'newest',
  OLDEST = 'oldest',
}

export class SearchProductsDto {
  @IsOptional()
  @IsString()
  keyword?: string; // Tìm theo từ khóa (tên hoặc mô tả)

  @IsOptional()
  @Type(() => Number) // Tự động ép chuỗi query param về số
  @IsNumber()
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  brandId?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(ProductSortBy)
  sortBy?: ProductSortBy = ProductSortBy.NEWEST;
}
```

---

### Bước 3: Viết Logic Nghiệp Vụ trong `Service`
> 📁 Vị trí: `src/<ten-module>/<ten-module>.service.ts`

Service chỉ tập trung vào xử lý logic nghiệp vụ và query database qua `PrismaService`.

> ⚠️ **LƯU Ý QUAN TRỌNG:** Dự án dùng chuẩn **ES Modules** (`"type": "module"` trong `package.json`), mọi đường dẫn import file nội bộ **bắt buộc phải có đuôi `.js`** (ví dụ: `../prisma/prisma.service.js`).

**Ví dụ: Logic tìm kiếm linh hoạt (`src/products/products.service.ts`)**
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchProductsDto, ProductSortBy } from './dto/search-products.dto.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

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

    // 1. Xây dựng điều kiện lọc (where)
    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    // Tìm kiếm từ khóa không phân biệt hoa thường (mode: 'insensitive')
    if (keyword && keyword.trim() !== '') {
      where.OR = [
        { name: { contains: keyword.trim(), mode: 'insensitive' } },
        { description: { contains: keyword.trim(), mode: 'insensitive' } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;

    // Lọc theo khoảng giá basePrice
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {};
      if (minPrice !== undefined) where.basePrice.gte = new Prisma.Decimal(minPrice);
      if (maxPrice !== undefined) where.basePrice.lte = new Prisma.Decimal(maxPrice);
    }

    // 2. Xây dựng điều kiện sắp xếp
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy === ProductSortBy.PRICE_ASC) orderBy = { basePrice: 'asc' };
    if (sortBy === ProductSortBy.PRICE_DESC) orderBy = { basePrice: 'desc' };
    if (sortBy === ProductSortBy.OLDEST) orderBy = { createdAt: 'asc' };

    // 3. Phân trang
    const skip = (page - 1) * limit;
    const take = limit;

    // 4. Query song song lấy data và đếm tổng (Promise.all)
    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
          images: { orderBy: { displayOrder: 'asc' } },
          skus: { where: { isActive: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Tìm kiếm sản phẩm thành công',
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
}
```

---

### Bước 4: Tạo Route và Endpoint trong `Controller`
> 📁 Vị trí: `src/<ten-module>/<ten-module>.controller.ts`

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { SearchProductsDto } from './dto/search-products.dto.js';

@Controller('products') // Đường dẫn gốc: /products
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('search') // GET http://localhost:8080/products/search
  search(@Query() query: SearchProductsDto) {
    return this.productsService.search(query);
  }

  @Get() // GET http://localhost:8080/products
  findAll(@Query() query: SearchProductsDto) {
    return this.productsService.search(query);
  }
}
```

---

### Bước 5: Đăng ký Controller & Service vào Module và `AppModule`

1. Tạo file module `src/products/products.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

2. Đăng ký vào `src/app.module.ts`:
```typescript
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [
    // ... các module khác
    ProductsModule, // <-- Thêm vào đây
  ],
})
export class AppModule {}
```

---

## 3. Các Lệnh Cần Biết

| Thao tác | Câu lệnh | Mô tả |
| :--- | :--- | :--- |
| **Khởi động server dev** | `npm run start:dev` | Lắng nghe thay đổi code tự động reload (hot-reload) |
| **Kiểm tra lỗi build** | `npm run build` | Kiểm tra TypeScript type check |
| **Đồng bộ Schema vào DB** | `npx prisma db push --accept-data-loss` | Đẩy thay đổi `schema.prisma` vào Postgres |
| **Sinh Prisma Client** | `npx prisma generate` | Cập nhật gợi ý code type cho `@prisma/client` |
| **Chạy Seed dữ liệu** | `npx tsx prisma/seed.ts` | Nạp Roles & Tài khoản mặc định vào database |

---

## 4. Tài Khoản Mặc Định Được Seed Sẵn

Sau khi chạy `npx tsx prisma/seed.ts`, hệ thống đã tạo sẵn 3 tài khoản:

| Quyền (Role) | Email đăng nhập | Mật khẩu mặc định |
| :--- | :--- | :--- |
| **ROLE_ADMIN** | `admin@tlusport.com` | `Password123@` |
| **ROLE_STAFF** | `staff@tlusport.com` | `Password123@` |
| **ROLE_USER** | `user@tlusport.com` | `Password123@` |

---

## 5. Ví Dụ Gọi Thử API Tìm Kiếm Sản Phẩm

- **Tìm từ khóa:**
  ```http
  GET http://localhost:8080/products/search?keyword=Nike
  ```
- **Tìm kèm lọc khoảng giá và sắp xếp:**
  ```http
  GET http://localhost:8080/products/search?keyword=áo&minPrice=200000&maxPrice=1000000&sortBy=price_asc
  ```
- **Lọc theo danh mục và phân trang:**
  ```http
  GET http://localhost:8080/products/search?categoryId=1&page=1&limit=5
  ```

---

## 6. Hệ Thống Xác Thực (JWT & Refresh Token)

Dự án đã tích hợp hoàn chỉnh module `Auth` tại thư mục `src/auth/` hỗ trợ:
- **Access Token** (hết hạn trong 15 phút): Dùng để gọi API.
- **Refresh Token** (hết hạn trong 7 ngày): Dùng để cấp lại Access Token mới mà không cần đăng nhập lại.
- **Token Rotation & Bảo mật**: Hash Refresh Token lưu trong PostgreSQL (`users.refresh_token`), tự động thu hồi khi Đăng xuất (Logout).

### A. Danh sách các API Auth có sẵn

| Method | Endpoint | Yêu cầu Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Không | Đăng nhập nhận `accessToken` & `refreshToken` |
| `POST` | `/auth/refresh` | Không | Gửi `refreshToken` để nhận cặp token mới |
| `POST` | `/auth/logout` | `Bearer Token` | Thu hồi Refresh Token trong DB |
| `GET` | `/auth/profile` | `Bearer Token` | Xem thông tin tài khoản hiện tại |
| `GET` | `/auth/admin-only`| `Bearer Token` + `ADMIN` | Demo endpoint chỉ `ROLE_ADMIN` mới vào được |

### B. Cách hoạt động với HttpOnly Cookie (Bảo mật tối đa)

1. **Đăng nhập (`POST /auth/login`):**
   ```json
   // Request Body:
   {
     "email": "admin@tlusport.com",
     "password": "Password123@"
   }
   ```
   - **Response Header (Set-Cookie):** Tự động gắn cookie `refreshToken` với cờ `HttpOnly; SameSite=Lax; Max-Age=604800` (7 ngày).
   - **Response Body:** Chỉ trả về `accessToken` để Frontend lưu vào memory/state (không sợ bị đánh cắp refreshToken qua XSS):
     ```json
     {
       "message": "Đăng nhập thành công",
       "accessToken": "eyJhbGciOi..."
     }
     ```

2. **Gọi API yêu cầu đăng nhập:**
   Gắn header:
   ```http
   Authorization: Bearer <accessToken>
   ```

3. **Khi Access Token hết hạn -> Làm mới token (`POST /auth/refresh`):**
   - **Trên trình duyệt:** Trình duyệt tự động gửi kèm cookie `refreshToken`, request body có thể để trống `{}`.
   - **Trên Postman:** Nếu không dùng cookie, vẫn hỗ trợ truyền qua body `{ "refreshToken": "..." }`.
   - **Server:** Tự động kiểm tra hash trong DB, xoay vòng (Token Rotation) cấp Access Token mới và ghi đè Cookie Refresh Token mới.

4. **Đăng xuất (`POST /auth/logout`):**
   - Server xóa hash trong PostgreSQL và xóa sạch Cookie trên trình duyệt (`res.clearCookie('refreshToken')`).

### C. Cách bảo vệ bất kỳ API nào bằng Decorator

- **Bảo vệ chỉ cần đăng nhập:**
  ```typescript
  @Get('my-data')
  @UseGuards(JwtAuthGuard)
  getMyData(@CurrentUser() user: any) {
    return user;
  }
  ```

- **Bảo vệ theo Quyền (Role):**
  ```typescript
  @Post('admin-action')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROLE_ADMIN')
  doAdminAction() { ... }
  ```

