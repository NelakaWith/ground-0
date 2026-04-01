import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import providers from './feed/providers';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('providers')
  getProviders() {
    return providers;
  }
}
