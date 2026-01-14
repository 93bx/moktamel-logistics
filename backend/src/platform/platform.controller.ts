import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { PlatformService } from './platform.service';

const BootstrapSchema = z.object({
  company_name: z.string().min(2),
  company_slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'company_slug must be lowercase letters/numbers/dashes'),
  owner_email: z.string().email(),
  owner_password: z.string().min(12),
});

@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Post('bootstrap')
  async bootstrap(@Body() body: unknown) {
    const input = BootstrapSchema.parse(body);
    return await this.platform.bootstrap(input);
  }
}


