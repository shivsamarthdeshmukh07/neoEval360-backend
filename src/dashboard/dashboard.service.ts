import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { User, Role, EmployeeStatus, ProjectStatus, AllocationStatus, TrialStatus, ContractStatus, EvaluationStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getAuditDashboard() {
    const totalEmployees = await this.prisma.user.count({ where: { active: true } });
    const trialEmployees = await this.prisma.user.count({ where: { active: true, status: EmployeeStatus.TRIAL } });
    const confirmedEmployees = await this.prisma.user.count({ where: { active: true, status: EmployeeStatus.CONFIRMED } });
    const benchEmployees = await this.prisma.user.count({ where: { active: true, status: EmployeeStatus.BENCH } });
    const activeProjects = await this.prisma.project.count({ where: { status: ProjectStatus.ACTIVE } });

    // Expiry alerts (within 15 days)
    const fifteenDays = new Date();
    fifteenDays.setDate(fifteenDays.getDate() + 15);
    const contractExpiryAlerts = await this.prisma.contract.count({
      where: {
        contractEndDate: { lte: fifteenDays },
        status: { in: [ContractStatus.ACTIVE, ContractStatus.EXPIRING_SOON] },
      },
    });

    // Evaluation completion % for active cycles
    const activeCycle = await this.prisma.evaluationCycle.findFirst({ where: { active: true } });
    let evaluationCompletionPercentage = 0;
    if (activeCycle) {
      const totalEval = await this.prisma.performanceEvaluation.count({ where: { evaluationCycleId: activeCycle.id } });
      const completedEval = await this.prisma.performanceEvaluation.count({
        where: { evaluationCycleId: activeCycle.id, status: EvaluationStatus.FINALIZED },
      });
      evaluationCompletionPercentage = totalEval > 0 ? (completedEval / totalEval) * 100 : 0;
    }

    // Resource Utilization % (average allocation percentage of active DEV role employees)
    const activeDevs = await this.prisma.user.findMany({ where: { role: Role.DEV, active: true } });
    let totalUtilization = 0;
    for (const dev of activeDevs) {
      const allocations = await this.prisma.resourceAllocation.findMany({
        where: { developerId: dev.id, status: AllocationStatus.APPROVED },
      });
      totalUtilization += allocations.reduce((sum, alloc) => sum + alloc.allocationPercentage, 0);
    }
    const resourceUtilizationPercentage = activeDevs.length > 0 ? totalUtilization / activeDevs.length : 0;

    return {
      totalEmployees,
      trialEmployees,
      confirmedEmployees,
      benchEmployees,
      activeProjects,
      contractExpiryAlerts,
      evaluationCompletionPercentage: Math.round(evaluationCompletionPercentage),
      resourceUtilizationPercentage: Math.round(resourceUtilizationPercentage),
    };
  }

  async getVPDashboard(user: User) {
    // 1. Department Performance (average score of completed evaluations)
    const departmentPerformance = await this.prisma.performanceEvaluation.groupBy({
      by: ['developerId'],
      _avg: { finalScore: true },
      where: { status: EvaluationStatus.FINALIZED },
    });

    // Fetch details to map to departments
    const finalizedEvals = await this.prisma.performanceEvaluation.findMany({
      where: { status: EvaluationStatus.FINALIZED },
      select: {
        finalScore: true,
        developer: { select: { department: true } },
      },
    });

    const deptSums: { [key: string]: { sum: number; count: number } } = {};
    for (const ev of finalizedEvals) {
      if (ev.finalScore) {
        const dept = ev.developer.department;
        const score = Number(ev.finalScore);
        if (!deptSums[dept]) {
          deptSums[dept] = { sum: 0, count: 0 };
        }
        deptSums[dept].sum += score;
        deptSums[dept].count += 1;
      }
    }

    const deptPerformanceMapped = Object.keys(deptSums).map(dept => ({
      department: dept,
      averageScore: Math.round((deptSums[dept].sum / deptSums[dept].count) * 100) / 100,
    }));

    // 2. Contract Expirations (30 days summary)
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    const expiringContracts = await this.prisma.contract.findMany({
      where: {
        contractEndDate: { lte: thirtyDays },
        status: { in: [ContractStatus.ACTIVE, ContractStatus.EXPIRING_SOON] },
      },
      include: {
        employee: { select: { fullName: true } },
        project: { select: { name: true } },
      },
    });

    // 3. Team performance (averages by Team Lead)
    const leadEvals = await this.prisma.performanceEvaluation.findMany({
      where: { status: EvaluationStatus.FINALIZED },
      select: {
        finalScore: true,
        developer: { select: { teamLead: { select: { fullName: true } } } },
      },
    });

    const leadSums: { [key: string]: { sum: number; count: number } } = {};
    for (const ev of leadEvals) {
      const leadName = ev.developer.teamLead?.fullName || 'Unassigned';
      const score = Number(ev.finalScore || 0);
      if (!leadSums[leadName]) {
        leadSums[leadName] = { sum: 0, count: 0 };
      }
      leadSums[leadName].sum += score;
      leadSums[leadName].count += 1;
    }

    const teamPerformanceMapped = Object.keys(leadSums).map(lead => ({
      teamLead: lead,
      averageScore: Math.round((leadSums[lead].sum / leadSums[lead].count) * 100) / 100,
    }));

    // 4. Overall utilization of VP reports
    const reports = await this.prisma.user.findMany({
      where: { vicePresidentId: user.id, role: Role.DEV, active: true },
    });

    let totalVPUtilization = 0;
    for (const dev of reports) {
      const allocations = await this.prisma.resourceAllocation.findMany({
        where: { developerId: dev.id, status: AllocationStatus.APPROVED },
      });
      totalVPUtilization += allocations.reduce((sum, alloc) => sum + alloc.allocationPercentage, 0);
    }
    const vpUtilization = reports.length > 0 ? totalVPUtilization / reports.length : 0;

    return {
      departmentPerformance: deptPerformanceMapped,
      expiringContractsSummary: expiringContracts.map(c => ({
        employeeName: c.employee.fullName,
        projectName: c.project.name,
        endDate: c.contractEndDate,
        status: c.status,
      })),
      teamPerformance: teamPerformanceMapped,
      utilizationReport: {
        totalDevelopers: reports.length,
        averageUtilization: Math.round(vpUtilization),
      },
    };
  }

  async getSalesDashboard(user: User) {
    // Determine sales visibility filter
    const salesOwnerIds: string[] = [user.id];
    if (user.role === Role.SALES_HEAD) {
      const subSales = await this.prisma.user.findMany({
        where: { parentSalesHeadId: user.id, role: Role.SALES, active: true },
      });
      salesOwnerIds.push(...subSales.map(u => u.id));
    }

    const clients = await this.prisma.client.findMany({
      where: { salesOwnerId: { in: salesOwnerIds } },
    });

    const activeContracts = await this.prisma.contract.findMany({
      where: {
        project: { salesOwnerId: { in: salesOwnerIds } },
        status: ContractStatus.ACTIVE,
      },
      include: {
        employee: { select: { fullName: true } },
        project: { select: { name: true } },
      },
    });

    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    const expiringContracts = await this.prisma.contract.findMany({
      where: {
        project: { salesOwnerId: { in: salesOwnerIds } },
        contractEndDate: { lte: thirtyDays },
        status: { in: [ContractStatus.ACTIVE, ContractStatus.EXPIRING_SOON] },
      },
      include: {
        employee: { select: { fullName: true } },
        project: { select: { name: true } },
      },
    });

    const trialResources = await this.prisma.trial.findMany({
      where: {
        project: { salesOwnerId: { in: salesOwnerIds } },
        status: TrialStatus.PENDING,
      },
      include: {
        employee: { select: { fullName: true, designation: true } },
        project: { select: { name: true } },
      },
    });

    return {
      clientCount: clients.length,
      clients: clients.map(c => ({ id: c.id, name: c.name })),
      activeContractsCount: activeContracts.length,
      expiringContracts: expiringContracts.map(c => ({
        employeeName: c.employee.fullName,
        projectName: c.project.name,
        endDate: c.contractEndDate,
      })),
      trialResources: trialResources.map(t => ({
        employeeName: t.employee.fullName,
        designation: t.employee.designation,
        projectName: t.project.name,
        endDate: t.trialEndDate,
      })),
    };
  }

  async getDMDashboard(user: User) {
    const teamMembers = await this.prisma.user.findMany({
      where: { deliveryManagerId: user.id, role: Role.DEV, active: true },
    });

    let totalDMUtilization = 0;
    for (const dev of teamMembers) {
      const allocations = await this.prisma.resourceAllocation.findMany({
        where: { developerId: dev.id, status: AllocationStatus.APPROVED },
      });
      totalDMUtilization += allocations.reduce((sum, alloc) => sum + alloc.allocationPercentage, 0);
    }
    const dmUtilization = teamMembers.length > 0 ? totalDMUtilization / teamMembers.length : 0;

    const pendingEvaluations = await this.prisma.performanceEvaluation.findMany({
      where: {
        developer: { deliveryManagerId: user.id },
        status: EvaluationStatus.REVIEWED_TL,
      },
      include: {
        developer: { select: { fullName: true, designation: true } },
      },
    });

    const trialResources = await this.prisma.trial.findMany({
      where: {
        employee: { deliveryManagerId: user.id },
        status: TrialStatus.PENDING,
      },
      include: {
        employee: { select: { fullName: true } },
        project: { select: { name: true } },
      },
    });

    return {
      teamCapacity: teamMembers.length,
      teamUtilization: Math.round(dmUtilization),
      pendingEvaluationsCount: pendingEvaluations.length,
      pendingEvaluations: pendingEvaluations.map(e => ({
        id: e.id,
        developerName: e.developer.fullName,
        designation: e.developer.designation,
        status: e.status,
      })),
      trialResources: trialResources.map(t => ({
        id: t.id,
        employeeName: t.employee.fullName,
        projectName: t.project.name,
        endDate: t.trialEndDate,
      })),
    };
  }

  async getTLDashboard(user: User) {
    const teamMembers = await this.prisma.user.findMany({
      where: { teamLeadId: user.id, role: Role.DEV, active: true },
    });

    const pendingReviews = await this.prisma.performanceEvaluation.findMany({
      where: {
        developer: { teamLeadId: user.id },
        status: EvaluationStatus.SUBMITTED_SELF,
      },
      include: {
        developer: { select: { fullName: true, designation: true } },
      },
    });

    // Average performance ratings of direct reports
    const completedEvals = await this.prisma.performanceEvaluation.findMany({
      where: {
        developer: { teamLeadId: user.id },
        status: EvaluationStatus.FINALIZED,
      },
      include: {
        developer: { select: { fullName: true } },
      },
    });

    return {
      teamMembers: teamMembers.map(m => ({ id: m.id, fullName: m.fullName, designation: m.designation, status: m.status })),
      pendingReviews: pendingReviews.map(r => ({ id: r.id, developerName: r.developer.fullName, status: r.status })),
      performanceRatings: completedEvals.map(e => ({
        developerName: e.developer.fullName,
        score: Number(e.finalScore || 0),
      })),
    };
  }

  async getDevDashboard(user: User) {
    const approvedAllocations = await this.prisma.resourceAllocation.findMany({
      where: { developerId: user.id, status: AllocationStatus.APPROVED },
      include: { project: { select: { name: true } } },
    });

    const totalAllocation = approvedAllocations.reduce((sum, a) => sum + a.allocationPercentage, 0);

    const activeTrials = await this.prisma.trial.findMany({
      where: { employeeId: user.id, status: TrialStatus.PENDING },
      include: { project: { select: { name: true } } },
    });

    const activeContracts = await this.prisma.contract.findMany({
      where: { employeeId: user.id, status: ContractStatus.ACTIVE },
      include: { project: { select: { name: true } } },
    });

    const feedback = await this.prisma.continuousFeedback.findMany({
      where: { receiverId: user.id },
      include: { provider: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const evaluations = await this.prisma.performanceEvaluation.findMany({
      where: { developerId: user.id },
      include: { evaluationCycle: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      assignedProjects: approvedAllocations.map(a => ({
        projectName: a.project.name,
        allocationPercentage: a.allocationPercentage,
        startDate: a.startDate,
        endDate: a.endDate,
      })),
      totalAllocationPercentage: totalAllocation,
      trialStatus: activeTrials.map(t => ({
        projectName: t.project.name,
        trialEndDate: t.trialEndDate,
        status: t.status,
      })),
      contractStatus: activeContracts.map(c => ({
        projectName: c.project.name,
        contractEndDate: c.contractEndDate,
        status: c.status,
      })),
      recentFeedback: feedback.map(f => ({
        providerName: f.provider.fullName,
        feedbackText: f.feedbackText,
        rating: f.rating,
        createdAt: f.createdAt,
      })),
      evaluations: evaluations.map(e => ({
        cycleName: e.evaluationCycle.name,
        finalScore: e.finalScore ? Number(e.finalScore) : null,
        status: e.status,
      })),
    };
  }
}
