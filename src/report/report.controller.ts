import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.AUDIT, Role.VP, Role.DM, Role.SALES_HEAD, Role.SALES)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('export')
  async exportReport(
    @Query('type') type: 'performance' | 'utilization' | 'trial' | 'contract',
    @Query('format') format: 'csv' | 'excel' | 'pdf',
    @Res() res: Response,
  ) {
    let data: any[] = [];
    let title = '';
    let filename = '';

    switch (type) {
      case 'performance':
        data = await this.reportService.getPerformanceData();
        title = 'Employee Performance Evaluation Report';
        filename = 'Performance_Report';
        break;
      case 'utilization':
        data = await this.reportService.getUtilizationData();
        title = 'Resource Utilization Report';
        filename = 'Utilization_Report';
        break;
      case 'trial':
        data = await this.reportService.getTrialData();
        title = 'Trial Conversion Report';
        filename = 'Trial_Report';
        break;
      case 'contract':
        data = await this.reportService.getContractData();
        title = 'Contract Expiry and Renewal Report';
        filename = 'Contract_Report';
        break;
      default:
        res.status(400).json({ message: 'Invalid report type. Supported types: performance, utilization, trial, contract' });
        return;
    }

    if (format === 'csv') {
      const csv = this.reportService.exportToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      res.status(200).send(csv);
    } else if (format === 'excel') {
      const excelBuffer = await this.reportService.exportToExcel(data, type);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
      res.status(200).send(excelBuffer);
    } else if (format === 'pdf') {
      try {
        const pdfBuffer = await this.reportService.exportToPDF(data, title);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
        res.status(200).send(pdfBuffer);
      } catch (err) {
        res.status(500).json({ message: 'Failed to generate PDF report', error: err.message });
      }
    } else {
      res.status(400).json({ message: 'Invalid format type. Supported formats: csv, excel, pdf' });
    }
  }
}
