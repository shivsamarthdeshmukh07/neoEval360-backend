import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { TrialService } from './trial.service';
import { CreateTrialDto } from './dto/create-trial.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('trials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrialController {
  constructor(private readonly trialService: TrialService) {}

  @Post()
  @Roles(Role.AUDIT, Role.SALES, Role.DM)
  create(@Body() createTrialDto: CreateTrialDto) {
    return this.trialService.create(createTrialDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.trialService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trialService.findOne(id);
  }

  @Put(':id/feedback/client')
  @Roles(Role.SALES, Role.SALES_HEAD, Role.DM)
  submitClientFeedback(@Param('id') id: string, @Body() dto: FeedbackDto) {
    return this.trialService.submitClientFeedback(id, dto.feedback);
  }

  @Put(':id/feedback/tl')
  @Roles(Role.TL)
  submitTLFeedback(@Param('id') id: string, @Body() dto: FeedbackDto) {
    return this.trialService.submitTLFeedback(id, dto.feedback);
  }

  @Put(':id/feedback/dm')
  @Roles(Role.DM)
  submitDMFeedback(@Param('id') id: string, @Body() dto: FeedbackDto) {
    return this.trialService.submitDMFeedback(id, dto.feedback);
  }

  @Put(':id/approve')
  @Roles(Role.VP)
  approveTrial(@Param('id') id: string) {
    return this.trialService.approveTrial(id);
  }

  @Put(':id/reject')
  @Roles(Role.VP)
  rejectTrial(@Param('id') id: string) {
    return this.trialService.rejectTrial(id);
  }
}
