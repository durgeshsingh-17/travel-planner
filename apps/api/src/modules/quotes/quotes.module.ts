import { Module } from '@nestjs/common';

import { AdminQuotesController, AgentQuotesController, QuotesController } from './quotes.controller';
import { AdminQuotesService } from './admin-quotes.service';
import { AgentQuotesService } from './agent-quotes.service';
import { ContentModule } from '../content/content.module';
import { QuoteRequestsService } from './quote-requests.service';
import { QuoteRoutingService } from './quote-routing.service';

@Module({
  imports: [ContentModule],
  controllers: [QuotesController, AgentQuotesController, AdminQuotesController],
  providers: [QuoteRequestsService, QuoteRoutingService, AgentQuotesService, AdminQuotesService],
  exports: [QuoteRequestsService]
})
export class QuotesModule {}
