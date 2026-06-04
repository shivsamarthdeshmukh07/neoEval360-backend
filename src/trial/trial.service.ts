import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTrialDto } from './dto/create-trial.dto';
import { User, Role, TrialStatus, EmployeeStatus, ContractStatus } from '@prisma/client';

@Injectable()
export class TrialService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTrialDto) {
    const dev = await this.prisma.user.findUnique({ where: { id: dto.employeeId } });
    if (!dev) {
      throw new NotFoundException('Employee not found');
    }

    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Set employee status to TRIAL if it isn't already
    if (dev.status !== EmployeeStatus.TRIAL) {
      await this.prisma.user.update({
        where: { id: dto.employeeId },
        data: { status: EmployeeStatus.TRIAL },
      });
    }

    return this.prisma.trial.create({
      data: {
        employeeId: dto.employeeId,
        projectId: dto.projectId,
        trialStartDate: new Date(dto.trialStartDate),
        trialEndDate: new Date(dto.trialEndDate),
        status: TrialStatus.PENDING,
      },
    });
  }

  async findAll(user: User) {
    const whereClause: any = {};

    if (user.role === Role.DEV) {
      whereClause.employeeId = user.id;
    } else if (user.role === Role.TL) {
      whereClause.employee = { teamLeadId: user.id };
    } else if (user.role === Role.DM) {
      whereClause.OR = [
        { employee: { deliveryManagerId: user.id } },
        { project: { deliveryManagerId: user.id } },
      ];
    } else if (user.role === Role.SALES) {
      whereClause.project = { salesOwnerId: user.id };
    } else if (user.role === Role.SALES_HEAD) {
      whereClause.project = {
        OR: [
          { salesOwnerId: user.id },
          { salesOwner: { parentSalesHeadId: user.id } },
        ],
      };
    }

    return this.prisma.trial.findMany({
      where: whereClause,
      include: {
        employee: { select: { id: true, fullName: true, email: true, status: true } },
        project: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string) {
    const trial = await this.prisma.trial.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
            teamLead: { select: { id: true, fullName: true } },
            deliveryManager: { select: { id: true, fullName: true } },
            vicePresident: { select: { id: true, fullName: true } },
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            contractStartDate: true,
            contractEndDate: true,
          },
        },
      },
    });

    if (!trial) {
      throw new NotFoundException('Trial period not found');
    }

    return trial;
  }

  async submitClientFeedback(id: string, feedback: string) {
    const trial = await this.prisma.trial.findUnique({ where: { id } });
    if (!trial) throw new NotFoundException('Trial not found');

    return this.prisma.trial.update({
      where: { id },
      data: { clientFeedback: feedback },
    });
  }

  async submitTLFeedback(id: string, feedback: string) {
    const trial = await this.prisma.trial.findUnique({ where: { id } });
    if (!trial) throw new NotFoundException('Trial not found');

    return this.prisma.trial.update({
      where: { id },
      data: { teamLeadFeedback: feedback },
    });
  }

  async submitDMFeedback(id: string, feedback: string) {
    const trial = await this.prisma.trial.findUnique({ where: { id } });
    if (!trial) throw new NotFoundException('Trial not found');

    return this.prisma.trial.update({
      where: { id },
      data: {
        deliveryManagerFeedback: feedback,
        approvedByDM: true,
      },
    });
  }

  async approveTrial(id: string) {
    const trial = await this.prisma.trial.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!trial) throw new NotFoundException('Trial not found');

    if (!trial.approvedByDM) {
      throw new BadRequestException('Trial must be approved by the Delivery Manager first');
    }

    // Begin Transaction to approve trial, confirm employee and initialize contract
    return this.prisma.$transaction(async (tx) => {
      // 1. Update trial record
      const updatedTrial = await tx.trial.update({
        where: { id },
        data: {
          status: TrialStatus.PASSED,
          approvedByVP: true,
        },
      });

      // 2. Change employee status to CONFIRMED
      await tx.user.update({
        where: { id: trial.employeeId },
        data: { status: EmployeeStatus.CONFIRMED },
      });

      // 3. Create active Contract
      await tx.contract.create({
        data: {
          employeeId: trial.employeeId,
          projectId: trial.projectId,
          contractStartDate: trial.project.contractStartDate,
          contractEndDate: trial.project.contractEndDate,
          status: ContractStatus.ACTIVE,
          extensionHistory: [],
        },
      });

      return {
        message: 'Trial passed successfully. Employee status set to Confirmed, and Project Contract activated.',
        trial: updatedTrial,
      };
    });
  }

  async rejectTrial(id: string) {
    const trial = await this.prisma.trial.findUnique({ where: { id } });
    if (!trial) throw new NotFoundException('Trial not found');

    return this.prisma.$transaction(async (tx) => {
      const updatedTrial = await tx.trial.update({
        where: { id },
        data: { status: TrialStatus.FAILED },
      });

      // Reset employee to BENCH
      await tx.user.update({
        where: { id: trial.employeeId },
        data: { status: EmployeeStatus.BENCH },
      });

      return {
        message: 'Trial failed. Employee status set to Bench.',
        trial: updatedTrial,
      };
    });
  }
}
