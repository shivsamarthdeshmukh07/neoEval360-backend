import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '@prisma/client';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@Req() req: any) {
    const user = req.user;
    if (user.role === Role.AUDIT) {
      return this.dashboardService.getAuditDashboard();
    } else if (user.role === Role.VP) {
      return this.dashboardService.getVPDashboard(user);
    } else if (user.role === Role.SALES_HEAD || user.role === Role.SALES) {
      return this.dashboardService.getSalesDashboard(user);
    } else if (user.role === Role.DM) {
      return this.dashboardService.getDMDashboard(user);
    } else if (user.role === Role.TL) {
      return this.dashboardService.getTLDashboard(user);
    } else {
      return this.dashboardService.getDevDashboard(user);
    }
  }
}
