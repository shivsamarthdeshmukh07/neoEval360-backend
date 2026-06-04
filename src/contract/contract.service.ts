import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { ExtendContractDto } from './dto/extend-contract.dto';
import { User, Role, ContractStatus } from '@prisma/client';

interface ExtensionState {
  currentPending: {
    newEndDate: string;
    approvedByDM: boolean;
    approvedByVP: boolean;
    requestedBy: string;
  } | null;
  pastExtensions: Array<{
    startDate: string;
    endDate: string;
    extendedAt: string;
  }>;
}

@Injectable()
export class ContractService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateContractDto) {
    const employee = await this.prisma.user.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.contract.create({
      data: {
        employeeId: dto.employeeId,
        projectId: dto.projectId,
        contractStartDate: new Date(dto.contractStartDate),
        contractEndDate: new Date(dto.contractEndDate),
        status: dto.status,
        extensionHistory: { currentPending: null, pastExtensions: [] },
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
      whereClause.project = { deliveryManagerId: user.id };
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

    return this.prisma.contract.findMany({
      where: whereClause,
      include: {
        employee: { select: { id: true, fullName: true, email: true, employeeId: true } },
        project: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, fullName: true, email: true, status: true } },
        project: { select: { id: true, name: true } },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  private parseHistory(historyJson: any): ExtensionState {
    let parsed: any = historyJson;
    if (typeof historyJson === 'string') {
      try {
        parsed = JSON.parse(historyJson);
      } catch {
        parsed = [];
      }
    }

    if (Array.isArray(parsed)) {
      return { currentPending: null, pastExtensions: parsed };
    }

    return parsed || { currentPending: null, pastExtensions: [] };
  }

  async requestExtension(id: string, dto: ExtendContractDto, requesterId: string) {
    const contract = await this.findOne(id);
    const state = this.parseHistory(contract.extensionHistory);

    if (state.currentPending) {
      throw new BadRequestException('A contract extension request is already pending approval');
    }

    state.currentPending = {
      newEndDate: dto.newEndDate,
      approvedByDM: false,
      approvedByVP: false,
      requestedBy: requesterId,
    };

    return this.prisma.contract.update({
      where: { id },
      data: {
        extensionHistory: JSON.parse(JSON.stringify(state)),
      },
    });
  }

  async findPendingExtensions(user: User) {
    const allContracts = await this.prisma.contract.findMany({
      include: {
        employee: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true, deliveryManagerId: true } },
      },
    });

    return allContracts
      .map(c => ({
        ...c,
        parsedHistory: this.parseHistory(c.extensionHistory),
      }))
      .filter(c => {
        if (!c.parsedHistory.currentPending) return false;

        // Apply role filter on pending lists
        if (user.role === Role.DM) {
          return c.project.deliveryManagerId === user.id;
        }
        return true;
      })
      .map(c => {
        const { extensionHistory, parsedHistory, ...rest } = c;
        return {
          ...rest,
          pendingExtension: parsedHistory.currentPending,
        };
      });
  }

  async approveDM(id: string) {
    const contract = await this.findOne(id);
    const state = this.parseHistory(contract.extensionHistory);

    if (!state.currentPending) {
      throw new BadRequestException('No pending extension request found for this contract');
    }

    state.currentPending.approvedByDM = true;

    return this.prisma.contract.update({
      where: { id },
      data: {
        extensionHistory: JSON.parse(JSON.stringify(state)),
      },
    });
  }

  async approveVP(id: string) {
    const contract = await this.findOne(id);
    const state = this.parseHistory(contract.extensionHistory);

    if (!state.currentPending) {
      throw new BadRequestException('No pending extension request found for this contract');
    }

    if (!state.currentPending.approvedByDM) {
      throw new BadRequestException('Extension request must be approved by the Delivery Manager first');
    }

    // Capture old dates into archive
    state.pastExtensions.push({
      startDate: contract.contractStartDate.toISOString(),
      endDate: contract.contractEndDate.toISOString(),
      extendedAt: new Date().toISOString(),
    });

    const newEndDate = new Date(state.currentPending.newEndDate);
    state.currentPending = null; // Clear pending state

    return this.prisma.contract.update({
      where: { id },
      data: {
        contractEndDate: newEndDate,
        status: ContractStatus.RENEWED,
        extensionHistory: JSON.parse(JSON.stringify(state)),
      },
    });
  }

  async rejectExtension(id: string) {
    const contract = await this.findOne(id);
    const state = this.parseHistory(contract.extensionHistory);

    if (!state.currentPending) {
      throw new BadRequestException('No pending extension request found for this contract');
    }

    state.currentPending = null; // Clear pending state

    return this.prisma.contract.update({
      where: { id },
      data: {
        extensionHistory: JSON.parse(JSON.stringify(state)),
      },
    });
  }
}
