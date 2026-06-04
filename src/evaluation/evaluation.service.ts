import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { SubmitSelfDto } from './dto/submit-self.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { User, Role, EvaluationStatus } from '@prisma/client';

@Injectable()
export class EvaluationService {
  constructor(private prisma: PrismaService) {}

  // Cycles
  async createCycle(dto: CreateCycleDto) {
    const existing = await this.prisma.evaluationCycle.findUnique({ where: { name: dto.name } });
    if (existing) throw new BadRequestException('Cycle name already exists');

    return this.prisma.evaluationCycle.create({
      data: {
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        active: true,
      },
    });
  }

  async findAllCycles() {
    return this.prisma.evaluationCycle.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async initializeEvaluations(cycleId: string) {
    const cycle = await this.prisma.evaluationCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException('Evaluation cycle not found');

    const developers = await this.prisma.user.findMany({
      where: { role: Role.DEV, active: true },
    });

    let count = 0;
    for (const dev of developers) {
      // Check if evaluation already initialized
      const existing = await this.prisma.performanceEvaluation.findFirst({
        where: {
          developerId: dev.id,
          evaluationCycleId: cycleId,
        },
      });

      if (!existing) {
        await this.prisma.performanceEvaluation.create({
          data: {
            developerId: dev.id,
            evaluationCycleId: cycleId,
            status: EvaluationStatus.DRAFT,
          },
        });
        count++;
      }
    }

    return { message: `Initialized ${count} developer evaluations for cycle '${cycle.name}'` };
  }

  // Evaluations
  async findAllEvaluations(user: User) {
    const whereClause: any = {};

    if (user.role === Role.DEV) {
      whereClause.developerId = user.id;
    } else if (user.role === Role.TL) {
      whereClause.developer = { teamLeadId: user.id };
    } else if (user.role === Role.DM) {
      whereClause.developer = { deliveryManagerId: user.id };
    } else if (user.role === Role.VP) {
      whereClause.developer = { vicePresidentId: user.id };
    }

    return this.prisma.performanceEvaluation.findMany({
      where: whereClause,
      include: {
        developer: { select: { id: true, fullName: true, email: true, employeeId: true } },
        evaluationCycle: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneEvaluation(id: string) {
    const evaluation = await this.prisma.performanceEvaluation.findUnique({
      where: { id },
      include: {
        developer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            employeeId: true,
            teamLead: { select: { id: true, fullName: true } },
            deliveryManager: { select: { id: true, fullName: true } },
            vicePresident: { select: { id: true, fullName: true } },
          },
        },
        evaluationCycle: true,
      },
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluation record not found');
    }
    return evaluation;
  }

  async submitSelf(id: string, dto: SubmitSelfDto, developerId: string) {
    const evaluation = await this.findOneEvaluation(id);

    if (evaluation.developerId !== developerId) {
      throw new ForbiddenException('You can only submit self-assessment for your own evaluation record');
    }

    if (evaluation.status !== EvaluationStatus.DRAFT) {
      throw new BadRequestException('Self-assessment has already been submitted or is under review');
    }

    return this.prisma.performanceEvaluation.update({
      where: { id },
      data: {
        selfRating: dto.selfRating,
        selfFeedback: dto.selfFeedback,
        status: EvaluationStatus.SUBMITTED_SELF,
      },
    });
  }

  async submitTL(id: string, dto: SubmitReviewDto, tlId: string) {
    const evaluation = await this.findOneEvaluation(id);

    if (evaluation.developer.teamLead?.id !== tlId) {
      throw new ForbiddenException('You are not the designated Team Lead for this developer');
    }

    if (evaluation.status !== EvaluationStatus.SUBMITTED_SELF) {
      throw new BadRequestException('Developer self-assessment must be submitted first');
    }

    return this.prisma.performanceEvaluation.update({
      where: { id },
      data: {
        tlRating: dto.rating,
        tlFeedback: dto.feedback,
        status: EvaluationStatus.REVIEWED_TL,
      },
    });
  }

  async submitDM(id: string, dto: SubmitReviewDto, dmId: string) {
    const evaluation = await this.findOneEvaluation(id);

    if (evaluation.developer.deliveryManager?.id !== dmId) {
      throw new ForbiddenException('You are not the designated Delivery Manager for this developer');
    }

    if (evaluation.status !== EvaluationStatus.REVIEWED_TL) {
      throw new BadRequestException('Team Lead review must be completed first');
    }

    return this.prisma.performanceEvaluation.update({
      where: { id },
      data: {
        dmRating: dto.rating,
        dmFeedback: dto.feedback,
        status: EvaluationStatus.REVIEWED_DM,
      },
    });
  }

  async submitVP(id: string, dto: SubmitReviewDto, vpId: string) {
    const evaluation = await this.findOneEvaluation(id);

    if (evaluation.developer.vicePresident?.id !== vpId) {
      throw new ForbiddenException('You are not the designated Vice President for this developer');
    }

    if (evaluation.status !== EvaluationStatus.REVIEWED_DM) {
      throw new BadRequestException('Delivery Manager review must be completed first');
    }

    // Calculate final score as average of TL, DM and VP ratings
    const tl = evaluation.tlRating ?? 0;
    const dm = evaluation.dmRating ?? 0;
    const vp = dto.rating;
    const finalScore = (tl + dm + vp) / 3;

    return this.prisma.performanceEvaluation.update({
      where: { id },
      data: {
        vpRating: dto.rating,
        vpFeedback: dto.feedback,
        finalScore,
        status: EvaluationStatus.FINALIZED,
      },
    });
  }

  // Continuous Feedback
  async createFeedback(dto: CreateFeedbackDto, providerId: string) {
    if (providerId === dto.receiverId) {
      throw new BadRequestException('You cannot submit feedback for yourself');
    }

    const receiver = await this.prisma.user.findUnique({ where: { id: dto.receiverId } });
    if (!receiver) throw new NotFoundException('Receiver employee not found');

    return this.prisma.continuousFeedback.create({
      data: {
        providerId,
        receiverId: dto.receiverId,
        feedbackText: dto.feedbackText,
        rating: dto.rating,
      },
    });
  }

  async findAllFeedback(user: User) {
    const whereClause: any = {};

    if (user.role === Role.DEV) {
      whereClause.receiverId = user.id;
    } else if (user.role === Role.TL) {
      whereClause.receiver = { teamLeadId: user.id };
    } else if (user.role === Role.DM) {
      whereClause.receiver = { deliveryManagerId: user.id };
    } else if (user.role === Role.VP) {
      whereClause.receiver = { vicePresidentId: user.id };
    }

    return this.prisma.continuousFeedback.findMany({
      where: whereClause,
      include: {
        provider: { select: { id: true, fullName: true, designation: true } },
        receiver: { select: { id: true, fullName: true, designation: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
