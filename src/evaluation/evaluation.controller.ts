import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { SubmitSelfDto } from './dto/submit-self.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  // Cycles
  @Post('cycles')
  @Roles(Role.AUDIT)
  createCycle(@Body() dto: CreateCycleDto) {
    return this.evaluationService.createCycle(dto);
  }

  @Get('cycles')
  findAllCycles() {
    return this.evaluationService.findAllCycles();
  }

  @Post('cycles/:id/initialize')
  @Roles(Role.AUDIT)
  initializeEvaluations(@Param('id') id: string) {
    return this.evaluationService.initializeEvaluations(id);
  }

  // Evaluations
  @Get()
  findAllEvaluations(@Req() req: any) {
    return this.evaluationService.findAllEvaluations(req.user);
  }

  @Get('feedback')
  findAllFeedback(@Req() req: any) {
    return this.evaluationService.findAllFeedback(req.user);
  }

  @Get(':id')
  findOneEvaluation(@Param('id') id: string) {
    return this.evaluationService.findOneEvaluation(id);
  }

  @Put(':id/self')
  @Roles(Role.DEV)
  submitSelf(@Param('id') id: string, @Body() dto: SubmitSelfDto, @Req() req: any) {
    return this.evaluationService.submitSelf(id, dto, req.user.id);
  }

  @Put(':id/tl')
  @Roles(Role.TL)
  submitTL(@Param('id') id: string, @Body() dto: SubmitReviewDto, @Req() req: any) {
    return this.evaluationService.submitTL(id, dto, req.user.id);
  }

  @Put(':id/dm')
  @Roles(Role.DM)
  submitDM(@Param('id') id: string, @Body() dto: SubmitReviewDto, @Req() req: any) {
    return this.evaluationService.submitDM(id, dto, req.user.id);
  }

  @Put(':id/vp')
  @Roles(Role.VP)
  submitVP(@Param('id') id: string, @Body() dto: SubmitReviewDto, @Req() req: any) {
    return this.evaluationService.submitVP(id, dto, req.user.id);
  }

  // Continuous Feedback
  @Post('feedback')
  createFeedback(@Body() dto: CreateFeedbackDto, @Req() req: any) {
    return this.evaluationService.createFeedback(dto, req.user.id);
  }
}
