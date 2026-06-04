import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Role, TrialStatus, ContractStatus, EvaluationStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  // 1. Compile Data Methods
  async getPerformanceData() {
    const evals = await this.prisma.performanceEvaluation.findMany({
      include: {
        developer: { select: { fullName: true, employeeId: true, department: true } },
        evaluationCycle: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return evals.map(e => ({
      'Employee ID': e.developer.employeeId,
      'Full Name': e.developer.fullName,
      'Department': e.developer.department,
      'Evaluation Cycle': e.evaluationCycle.name,
      'Self Rating': e.selfRating ?? 'N/A',
      'TL Rating': e.tlRating ?? 'N/A',
      'DM Rating': e.dmRating ?? 'N/A',
      'VP Rating': e.vpRating ?? 'N/A',
      'Final Score': e.finalScore ? Number(e.finalScore) : 'Pending',
      'Status': e.status,
    }));
  }

  async getUtilizationData() {
    const devs = await this.prisma.user.findMany({
      where: { role: Role.DEV, active: true },
      include: {
        allocations: {
          where: { status: 'APPROVED' },
          include: { project: { select: { name: true } } },
        },
      },
    });

    const data: any[] = [];
    for (const dev of devs) {
      const activeAllocations = dev.allocations;
      const totalAllocated = activeAllocations.reduce((sum, a) => sum + a.allocationPercentage, 0);

      if (activeAllocations.length === 0) {
        data.push({
          'Employee ID': dev.employeeId,
          'Full Name': dev.fullName,
          'Department': dev.department,
          'Allocated Project': 'BENCH',
          'Allocation %': 0,
          'Total Developer Allocation %': 0,
        });
      } else {
        activeAllocations.forEach(alloc => {
          data.push({
            'Employee ID': dev.employeeId,
            'Full Name': dev.fullName,
            'Department': dev.department,
            'Allocated Project': alloc.project.name,
            'Allocation %': alloc.allocationPercentage,
            'Total Developer Allocation %': totalAllocated,
          });
        });
      }
    }

    return data;
  }

  async getTrialData() {
    const trials = await this.prisma.trial.findMany({
      include: {
        employee: { select: { fullName: true, employeeId: true, designation: true } },
        project: { select: { name: true } },
      },
    });

    return trials.map(t => ({
      'Employee ID': t.employee.employeeId,
      'Full Name': t.employee.fullName,
      'Designation': t.employee.designation,
      'Project': t.project.name,
      'Trial Start': t.trialStartDate.toISOString().split('T')[0],
      'Trial End': t.trialEndDate.toISOString().split('T')[0],
      'Outcome': t.status,
      'Approved by DM': t.approvedByDM ? 'Yes' : 'No',
      'Approved by VP': t.approvedByVP ? 'Yes' : 'No',
    }));
  }

  async getContractData() {
    const contracts = await this.prisma.contract.findMany({
      include: {
        employee: { select: { fullName: true, employeeId: true } },
        project: { select: { name: true } },
      },
    });

    return contracts.map(c => {
      // Safely parse history length
      let extensions = 0;
      try {
        const history: any = c.extensionHistory;
        if (history && history.pastExtensions) {
          extensions = history.pastExtensions.length;
        } else if (Array.isArray(history)) {
          extensions = history.length;
        }
      } catch {}

      return {
        'Employee ID': c.employee.employeeId,
        'Full Name': c.employee.fullName,
        'Project Name': c.project.name,
        'Contract Start': c.contractStartDate.toISOString().split('T')[0],
        'Contract End': c.contractEndDate.toISOString().split('T')[0],
        'Extensions Count': extensions,
        'Status': c.status,
      };
    });
  }

  // 2. Export Formatter Methods
  exportToCSV(data: any[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(row =>
        headers
          .map(header => {
            const val = row[header];
            const escaped = ('' + val).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      ),
    ];
    return csvRows.join('\n');
  }

  async exportToExcel(data: any[], sheetName: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      sheet.columns = headers.map(h => ({ header: h, key: h, width: 22 }));

      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      sheet.addRows(data);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportToPDF(data: any[], title: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const buffers: Buffer[] = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      // Title header
      doc.fontSize(20).text(title, { align: 'center' });
      doc.fontSize(10).text(`Generated: ${new Date().toISOString().split('T')[0]}`, { align: 'center' });
      doc.moveDown(2);

      if (data.length === 0) {
        doc.text('No data available for this report.');
        doc.end();
        return;
      }

      const headers = Object.keys(data[0]);
      const rowHeight = 20;
      const colWidth = 730 / headers.length; // landscape A4 is ~841 width, minus margins

      // Draw table headers
      let y = doc.y;
      doc.fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, 30 + i * colWidth, y, { width: colWidth - 5, lineBreak: false });
      });

      doc.moveTo(30, y + 12).lineTo(810, y + 12).stroke();
      doc.moveDown();

      // Draw table rows
      doc.font('Helvetica');
      data.forEach(row => {
        // If approaching bottom margin, add a page
        if (doc.y > 540) {
          doc.addPage();
          y = doc.y;
          // Re-draw headers
          doc.font('Helvetica-Bold');
          headers.forEach((h, i) => {
            doc.text(h, 30 + i * colWidth, y, { width: colWidth - 5, lineBreak: false });
          });
          doc.moveTo(30, y + 12).lineTo(810, y + 12).stroke();
          doc.font('Helvetica');
          doc.moveDown();
        }

        y = doc.y;
        headers.forEach((h, i) => {
          doc.text('' + row[h], 30 + i * colWidth, y, { width: colWidth - 5, lineBreak: true });
        });
        doc.moveDown(0.6);
      });

      doc.end();
    });
  }
}
