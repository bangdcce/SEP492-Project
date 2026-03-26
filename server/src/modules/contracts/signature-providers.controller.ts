import { Body, Controller, Param, Post } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { SignatureProviderWebhookDto } from './dto';

@Controller('signature-providers')
export class SignatureProvidersController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post(':provider/webhooks')
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() dto: SignatureProviderWebhookDto,
  ) {
    return this.contractsService.handleSignatureProviderWebhook(provider, dto);
  }
}
