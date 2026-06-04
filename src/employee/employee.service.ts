import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Role, User } from '@prisma/client';

@Injectable()
export class EmployeeService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { role?: Role; department?: string; status?: string; search?: string }) {
    const whereClause: any = { active: true };

    if (query.role) {
      whereClause.role = query.role;
    }
    if (query.department) {
      whereClause.department = { contains: query.department, mode: 'insensitive' };
    }
    if (query.status) {
      whereClause.status = query.status;
    }
    if (query.search) {
      whereClause.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { employeeId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        employeeId: true,
        email: true,
        fullName: true,
        designation: true,
        department: true,
        joiningDate: true,
        role: true,
        status: true,
        skills: true,
        experienceYears: true,
        certifications: true,
        teamLead: { select: { id: true, fullName: true } },
        deliveryManager: { select: { id: true, fullName: true } },
        vicePresident: { select: { id: true, fullName: true } },
        parentSalesHead: { select: { id: true, fullName: true } },
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        teamLead: { select: { id: true, fullName: true, email: true } },
        deliveryManager: { select: { id: true, fullName: true, email: true } },
        vicePresident: { select: { id: true, fullName: true, email: true } },
        parentSalesHead: { select: { id: true, fullName: true, email: true } },
        teamMembers: { select: { id: true, fullName: true, designation: true } },
        dmReports: { select: { id: true, fullName: true, designation: true } },
        vpReports: { select: { id: true, fullName: true, designation: true } },
        salesAgents: { select: { id: true, fullName: true, designation: true } },
      },
    });

    if (!user || !user.active) {
      throw new NotFoundException('Employee not found');
    }

    return user;
  }

  async update(id: string, updateDto: UpdateEmployeeDto, currentUser: User) {
    const employee = await this.prisma.user.findUnique({ where: { id } });
    if (!employee || !employee.active) {
      throw new NotFoundException('Employee not found');
    }

    // Role-based validation
    if (currentUser.role !== Role.AUDIT) {
      // Normal users can only update their own skills/certifications
      if (currentUser.id !== id) {
        throw new ForbiddenException('You can only update your own profile');
      }

      // Restrict fields for non-audit
      const allowedKeys = ['skills', 'certifications'];
      const updateKeys = Object.keys(updateDto);
      const invalidKeys = updateKeys.filter(k => !allowedKeys.includes(k));
      if (invalidKeys.length > 0) {
        throw new ForbiddenException('Only system auditors can modify structural hierarchy, role, or status');
      }
    }

    // Validate relations if updated by Audit
    const dataToUpdate: any = { ...updateDto };

    if (updateDto.parentSalesHeadId) {
      const parent = await this.prisma.user.findUnique({ where: { id: updateDto.parentSalesHeadId } });
      if (!parent || parent.role !== Role.SALES_HEAD) {
        throw new BadRequestException('Invalid parent Sales Head selection');
      }
    }
    if (updateDto.teamLeadId) {
      const parent = await this.prisma.user.findUnique({ where: { id: updateDto.teamLeadId } });
      if (!parent || parent.role !== Role.TL) {
        throw new BadRequestException('Invalid Team Lead selection');
      }
    }
    if (updateDto.deliveryManagerId) {
      const parent = await this.prisma.user.findUnique({ where: { id: updateDto.deliveryManagerId } });
      if (!parent || parent.role !== Role.DM) {
        throw new BadRequestException('Invalid Delivery Manager selection');
      }
    }
    if (updateDto.vicePresidentId) {
      const parent = await this.prisma.user.findUnique({ where: { id: updateDto.vicePresidentId } });
      if (!parent || parent.role !== Role.VP) {
        throw new BadRequestException('Invalid Vice President selection');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    const { passwordHash: _, ...result } = updated;
    return result;
  }

  async remove(id: string) {
    const employee = await this.prisma.user.findUnique({ where: { id } });
    if (!employee || !employee.active) {
      throw new NotFoundException('Employee not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });

    return { message: 'Employee deactivated successfully' };
  }

  async getHierarchyTree() {
    const allUsers = await this.prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        designation: true,
        role: true,
        teamLeadId: true,
        deliveryManagerId: true,
        vicePresidentId: true,
        parentSalesHeadId: true,
      },
    });

    const vps = allUsers.filter(u => u.role === Role.VP);
    const salesHeads = allUsers.filter(u => u.role === Role.SALES_HEAD);

    const buildDeliveryTree = (vp: any) => {
      const dms = allUsers.filter(u => u.vicePresidentId === vp.id && u.role === Role.DM);
      return {
        id: vp.id,
        fullName: vp.fullName,
        email: vp.email,
        designation: vp.designation,
        role: vp.role,
        reports: dms.map(dm => {
          const tls = allUsers.filter(u => u.deliveryManagerId === dm.id && u.role === Role.TL);
          return {
            id: dm.id,
            fullName: dm.fullName,
            email: dm.email,
            designation: dm.designation,
            role: dm.role,
            reports: tls.map(tl => {
              const devs = allUsers.filter(u => u.teamLeadId === tl.id && u.role === Role.DEV);
              return {
                id: tl.id,
                fullName: tl.fullName,
                email: tl.email,
                designation: tl.designation,
                role: tl.role,
                reports: devs.map(dev => ({
                  id: dev.id,
                  fullName: dev.fullName,
                  email: dev.email,
                  designation: dev.designation,
                  role: dev.role,
                })),
              };
            }),
          };
        }),
      };
    };

    const buildSalesTree = (sh: any) => {
      const agents = allUsers.filter(u => u.parentSalesHeadId === sh.id && u.role === Role.SALES);
      return {
        id: sh.id,
        fullName: sh.fullName,
        email: sh.email,
        designation: sh.designation,
        role: sh.role,
        reports: agents.map(agent => ({
          id: agent.id,
          fullName: agent.fullName,
          email: agent.email,
          designation: agent.designation,
          role: agent.role,
        })),
      };
    };

    return {
      deliveryHierarchy: vps.map(buildDeliveryTree),
      salesHierarchy: salesHeads.map(buildSalesTree),
      unassignedOrAuditors: allUsers
        .filter(
          u => u.role === Role.AUDIT ||
          (u.role === Role.DEV && !u.teamLeadId) ||
          (u.role === Role.TL && !u.deliveryManagerId) ||
          (u.role === Role.DM && !u.vicePresidentId) ||
          (u.role === Role.SALES && !u.parentSalesHeadId)
        )
        .map(u => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          designation: u.designation,
          role: u.role,
        })),
    };
  }
}
