import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { SearchProductsDto } from './dto/search-products.dto.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('search')
  search(@Query() query: SearchProductsDto) {
    return this.productsService.search(query);
  }

  @Get()
  findAll(@Query() query: SearchProductsDto) {
    return this.productsService.search(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getProductById(id);
  }
}
