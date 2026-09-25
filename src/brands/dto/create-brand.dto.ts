import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBrandDto {
  @IsString({ message: 'Tên thương hiệu phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên thương hiệu không được để trống' })
  @MaxLength(100, { message: 'Tên thương hiệu tối đa 100 ký tự' })
  name: string;
  @IsString({ message: 'Slug phải là chuỗi' })
  @IsNotEmpty({ message: 'Slug không được để trống' })
  @MaxLength(100, { message: 'Slug tối đa 100 ký tự' })
  slug: string;
  @IsOptional()
  @IsString({ message: 'Logo URL phải là chuỗi' })
  logoUrl?: string;
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  description?: string;
}
