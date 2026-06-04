import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { User, Role, ProjectStatus, AllocationStatus } from '@prisma/client';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  // Client Management
  async createClient(dto: CreateClientDto) {
    const existing = await this.prisma.client.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new BadRequestException('Client name already exists');
    }
    const salesOwner = await this.prisma.user.findUnique({ where: { id: dto.salesOwnerId } });
    if (!salesOwner || (salesOwner.role !== Role.SALES && salesOwner.role !== Role.SALES_HEAD)) {
      throw new BadRequestException('Invalid sales owner selection');
    }
    return this.prisma.client.create({ data: dto });
  }

  async findAllClients() {
    return this.prisma.client.findMany({
      include: {
        salesOwner: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async updateClient(id: string, dto: CreateClientDto) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    const salesOwner = await this.prisma.user.findUnique({ where: { id: dto.salesOwnerId } });
    if (!salesOwner || (salesOwner.role !== Role.SALES && salesOwner.role !== Role.SALES_HEAD)) {
      throw new BadRequestException('Invalid sales owner selection');
    }
    return this.prisma.client.update({
      where: { id },
      data: dto,
    });
  }

  async deleteClient(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    await this.prisma.client.delete({ where: { id } });
    return { message: 'Client deleted successfully' };
  }

  // Project Management
  async createProject(dto: CreateProjectDto) {
    // Validate related entities
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new BadRequestException('Invalid Client selected');

    const salesOwner = await this.prisma.user.findUnique({ where: { id: dto.salesOwnerId } });
    if (!salesOwner || (salesOwner.role !== Role.SALES && salesOwner.role !== Role.SALES_HEAD)) {
      throw new BadRequestException('Invalid Sales Owner selected');
    }

    const dm = await this.prisma.user.findUnique({ where: { id: dto.deliveryManagerId } });
    if (!dm || dm.role !== Role.DM) {
      throw new BadRequestException('Invalid Delivery Manager selected');
    }

    const tl = await this.prisma.user.findUnique({ where: { id: dto.teamLeadId } });
    if (!tl || tl.role !== Role.TL) {
      throw new BadRequestException('Invalid Team Lead selected');
    }

    return this.prisma.project.create({
      data: {
        name: dto.name,
        clientId: dto.clientId,
        salesOwnerId: dto.salesOwnerId,
        deliveryManagerId: dto.deliveryManagerId,
        teamLeadId: dto.teamLeadId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        contractStartDate: new Date(dto.contractStartDate),
        contractEndDate: new Date(dto.contractEndDate),
        status: dto.status,
      },
    });
  }

  async findAllProjects(user: User) {
    const whereClause: any = {};

    // Apply role-based visibility
    if (user.role === Role.DEV) {
      // Dev can see projects where they are allocated
      whereClause.allocations = {
        some: {
          developerId: user.id,
          status: AllocationStatus.APPROVED,
        },
      };
    } else if (user.role === Role.TL) {
      whereClause.teamLeadId = user.id;
    } else if (user.role === Role.DM) {
      whereClause.deliveryManagerId = user.id;
    } else if (user.role === Role.SALES) {
      whereClause.salesOwnerId = user.id;
    } else if (user.role === Role.SALES_HEAD) {
      // Sales Head can see projects belonging to Sales reps in their hierarchy or their own
      whereClause.OR = [
        { salesOwnerId: user.id },
        { salesOwner: { parentSalesHeadId: user.id } },
      ];
    }

    return this.prisma.project.findMany({
      where: whereClause,
      include: {
        client: true,
        salesOwner: { select: { id: true, fullName: true } },
        deliveryManager: { select: { id: true, fullName: true } },
        teamLead: { select: { id: true, fullName: true } },
        allocations: {
          where: { status: AllocationStatus.APPROVED },
          include: { developer: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });
  }

  async findProjectById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        salesOwner: { select: { id: true, fullName: true, email: true } },
        deliveryManager: { select: { id: true, fullName: true, email: true } },
        teamLead: { select: { id: true, fullName: true, email: true } },
        allocations: {
          include: { developer: { select: { id: true, fullName: true, email: true, status: true } } },
        },
        trials: {
          include: { employee: { select: { id: true, fullName: true, email: true, status: true } } },
        },
        contracts: {
          include: { employee: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async updateProject(id: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        clientId: dto.clientId,
        salesOwnerId: dto.salesOwnerId,
        deliveryManagerId: dto.deliveryManagerId,
        teamLeadId: dto.teamLeadId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        contractStartDate: new Date(dto.contractStartDate),
        contractEndDate: new Date(dto.contractEndDate),
        status: dto.status,
      },
    });
  }

  async deleteProject(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    await this.prisma.project.delete({ where: { id } });
    return { message: 'Project deleted successfully' };
  }

  // Resource Allocation
  async createAllocation(projectId: string, dto: CreateAllocationDto, requesterId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const dev = await this.prisma.user.findUnique({ where: { id: dto.developerId } });
    if (!dev || dev.role !== Role.DEV) {
      throw new BadRequestException('Target resource must be a Developer');
    }

    return this.prisma.resourceAllocation.create({
      data: {
        projectId,
        developerId: dto.developerId,
        allocationPercentage: dto.allocationPercentage,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: AllocationStatus.PENDING_APPROVAL,
        requestedById: requesterId,
      },
    });
  }

  async findPendingAllocations(user: User) {
    const whereClause: any = { status: AllocationStatus.PENDING_APPROVAL };

    if (user.role === Role.DM) {
      whereClause.requestedById = user.id;
    }

    return this.prisma.resourceAllocation.findMany({
      where: whereClause,
      include: {
        project: { select: { id: true, name: true } },
        developer: { select: { id: true, fullName: true, email: true } },
        requestedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async approveAllocation(allocationId: string, approverId: string) {
    const allocation = await this.prisma.resourceAllocation.findUnique({
      where: { id: allocationId },
    });
    if (!allocation) throw new NotFoundException('Allocation request not found');

    if (allocation.status !== AllocationStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Allocation request is not pending approval');
    }

    // Check if the developer exceeds 100% allocation
    const approvedAllocations = await this.prisma.resourceAllocation.findMany({
      where: {
        developerId: allocation.developerId,
        status: AllocationStatus.APPROVED,
      },
    });

    const currentTotal = approvedAllocations.reduce((sum, alloc) => sum + alloc.allocationPercentage, 0);
    const newTotal = currentTotal + allocation.allocationPercentage;

    if (newTotal > 100) {
      throw new BadRequestException(
        `Allocation failed. Developer currently has ${currentTotal}% approved allocation. Adding ${allocation.allocationPercentage}% would exceed the 100% limit (total: ${newTotal}%).`
      );
    }

    // Update status to Approved
    return this.prisma.resourceAllocation.update({
      where: { id: allocationId },
      data: {
        status: AllocationStatus.APPROVED,
        approvedById: approverId,
      },
    });
  }

  async rejectAllocation(allocationId: string, approverId: string) {
    const allocation = await this.prisma.resourceAllocation.findUnique({
      where: { id: allocationId },
    });
    if (!allocation) throw new NotFoundException('Allocation request not found');

    if (allocation.status !== AllocationStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Allocation request is not pending approval');
    }

    return this.prisma.resourceAllocation.update({
      where: { id: allocationId },
      data: {
        status: AllocationStatus.REJECTED,
        approvedById: approverId,
      },
    });
  }

  async deleteAllocation(allocationId: string, user: User) {
    const allocation = await this.prisma.resourceAllocation.findUnique({
      where: { id: allocationId },
    });
    if (!allocation) throw new NotFoundException('Allocation not found');

    // Only DM or VP or Audit can release allocations
    if (user.role !== Role.DM && user.role !== Role.VP && user.role !== Role.AUDIT) {
      throw new ForbiddenException('Only Delivery Managers, VPs, or Administrators can release resource allocations');
    }

    await this.prisma.resourceAllocation.delete({ where: { id: allocationId } });
    return { message: 'Resource allocation removed successfully' };
  }
}
