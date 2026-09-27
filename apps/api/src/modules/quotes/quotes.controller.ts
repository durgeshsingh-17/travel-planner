import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { QuoteRequestStatus } from '@prisma/client';

import { AdminQuotesService } from './admin-quotes.service';
import { AgentDto, AssignAgentsDto } from './dto/agent.dto';
import { AgentQuotesService } from './agent-quotes.service';
import { CreateQuoteRequestDto, DeclineRequestDto, SubmitQuoteDto } from './dto/quote-request.dto';
import { CurrentUserId } from '../auth/current-user.decorator';
import { QuoteRequestsService } from './quote-requests.service';
import { Roles } from '../auth/roles.decorator';
import { WRITE_THROTTLE } from '../../common/throttle/write.throttle';

const uuid = new ParseUUIDPipe();

/** Traveller: create and follow quote requests, compare and accept quotes. */
@ApiTags('quotes')
@Controller({ version: '1' })
export class QuotesController {
  constructor(private readonly requests: QuoteRequestsService) {}

  @Throttle(WRITE_THROTTLE)
  @Post('quote-requests')
  create(@CurrentUserId() userId: string, @Body() dto: CreateQuoteRequestDto) {
    return this.requests.create(userId, dto);
  }

  @Get('me/quote-requests')
  list(@CurrentUserId() userId: string) {
    return this.requests.list(userId);
  }

  @Get('me/quote-requests/:id')
  get(@CurrentUserId() userId: string, @Param('id', uuid) id: string) {
    return this.requests.get(userId, id);
  }

  @HttpCode(200)
  @Post('me/quote-requests/:id/cancel')
  cancel(@CurrentUserId() userId: string, @Param('id', uuid) id: string) {
    return this.requests.cancel(userId, id);
  }

  @HttpCode(200)
  @Post('me/quotes/:id/accept')
  accept(@CurrentUserId() userId: string, @Param('id', uuid) id: string) {
    return this.requests.accept(userId, id);
  }

  @HttpCode(200)
  @Post('me/quotes/:id/decline')
  decline(@CurrentUserId() userId: string, @Param('id', uuid) id: string) {
    return this.requests.decline(userId, id);
  }
}

/** Agency users: requests routed to their agency. */
@ApiTags('quotes')
@Roles('AGENT')
@Controller({ path: 'agent/quote-requests', version: '1' })
export class AgentQuotesController {
  constructor(private readonly agentQuotes: AgentQuotesService) {}

  @Get()
  async inbox(@CurrentUserId() userId: string) {
    const agent = await this.agentQuotes.agentForUser(userId);
    return { agent, requests: await this.agentQuotes.inbox(agent.id) };
  }

  @Get(':id')
  async request(@CurrentUserId() userId: string, @Param('id', uuid) id: string) {
    const agent = await this.agentQuotes.agentForUser(userId);
    return this.agentQuotes.request(agent.id, id);
  }

  @Post(':id/quotes')
  async submit(@CurrentUserId() userId: string, @Param('id', uuid) id: string, @Body() dto: SubmitQuoteDto) {
    const agent = await this.agentQuotes.agentForUser(userId);
    return this.agentQuotes.submitQuote(agent.id, id, dto, userId);
  }

  @HttpCode(200)
  @Post(':id/decline')
  async decline(@CurrentUserId() userId: string, @Param('id', uuid) id: string, @Body() dto: DeclineRequestDto) {
    const agent = await this.agentQuotes.agentForUser(userId);
    return this.agentQuotes.decline(agent.id, id, dto);
  }
}

/** Admins: agencies, every request, manual routing, quotes entered for an agency. */
@ApiTags('admin')
@Roles('ADMIN')
@Controller({ path: 'admin', version: '1' })
export class AdminQuotesController {
  constructor(
    private readonly admin: AdminQuotesService,
    private readonly agentQuotes: AgentQuotesService
  ) {}

  @Get('agents')
  listAgents() {
    return this.admin.listAgents();
  }

  @Post('agents')
  createAgent(@Body() dto: AgentDto, @CurrentUserId() actorId: string) {
    return this.admin.saveAgent(dto, actorId);
  }

  @Put('agents/:id')
  updateAgent(@Param('id', uuid) id: string, @Body() dto: AgentDto, @CurrentUserId() actorId: string) {
    return this.admin.saveAgent(dto, actorId, id);
  }

  @Get('quote-requests')
  listRequests(
    @Query('status', new ParseEnumPipe(QuoteRequestStatus, { optional: true })) status?: QuoteRequestStatus
  ) {
    return this.admin.listRequests(status);
  }

  @Get('quote-requests/:id')
  getRequest(@Param('id', uuid) id: string) {
    return this.admin.getRequest(id);
  }

  @HttpCode(200)
  @Post('quote-requests/:id/route')
  route(@Param('id', uuid) id: string, @Body() dto: AssignAgentsDto, @CurrentUserId() actorId: string) {
    return this.admin.route(id, dto.agentIds, actorId);
  }

  /** For agencies without an app login: staff enter the quote the agency sent by phone or email. */
  @Post('quote-requests/:id/agents/:agentId/quotes')
  async submitForAgent(
    @Param('id', uuid) id: string,
    @Param('agentId', uuid) agentId: string,
    @Body() dto: SubmitQuoteDto,
    @CurrentUserId() actorId: string
  ) {
    await this.agentQuotes.submitQuote(agentId, id, dto, actorId);
    return this.admin.getRequest(id);
  }
}
