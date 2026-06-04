import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async findAllForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.recipientId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async triggerReminderCron(secret: string) {
    const expectedSecret = process.env.CRON_SECRET || 'vercel-cron-secret-token-key-neoeval360';
    if (secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret token');
    }

    console.log('[Cron] Running trial and contract expiration checks...');
    const offsets = [15, 7, 3, 0];
    let createdCount = 0;

    for (const offset of offsets) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + offset);

      const startOfDay = new Date(targetDate.setUTCHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setUTCHours(23, 59, 59, 999));

      // 1. Process Trials
      const trials = await this.prisma.trial.findMany({
        where: {
          trialEndDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: 'PENDING',
        },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              teamLeadId: true,
              deliveryManagerId: true,
              vicePresidentId: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              salesOwnerId: true,
            },
          },
        },
      });

      for (const trial of trials) {
        const timeLabel = offset === 0 ? 'today' : `in ${offset} days`;
        const message = `Trial period for ${trial.employee.fullName} in project '${trial.project.name}' is ending ${timeLabel} (on ${trial.trialEndDate.toISOString().split('T')[0]}). Please complete reviews.`;

        const recipients = new Set<string>();
        recipients.add(trial.employee.id); // Developer
        if (trial.employee.teamLeadId) recipients.add(trial.employee.teamLeadId); // TL
        if (trial.employee.deliveryManagerId) recipients.add(trial.employee.deliveryManagerId); // DM
        if (trial.employee.vicePresidentId) recipients.add(trial.employee.vicePresidentId); // VP
        if (trial.project.salesOwnerId) recipients.add(trial.project.salesOwnerId); // Sales Owner

        for (const recipientId of recipients) {
          await this.prisma.notification.create({
            data: {
              recipientId,
              message,
              type: NotificationType.TRIAL_REMINDER,
            },
          });
          createdCount++;
        }
      }

      // 2. Process Contracts
      const contracts = await this.prisma.contract.findMany({
        where: {
          contractEndDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            in: ['ACTIVE', 'EXPIRING_SOON'],
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              teamLeadId: true,
              deliveryManagerId: true,
              vicePresidentId: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              salesOwnerId: true,
            },
          },
        },
      });

      for (const contract of contracts) {
        const timeLabel = offset === 0 ? 'today' : `in ${offset} days`;
        const message = `Contract for ${contract.employee.fullName} in project '${contract.project.name}' is ending ${timeLabel} (on ${contract.contractEndDate.toISOString().split('T')[0]}). Please review renewals.`;

        const recipients = new Set<string>();
        recipients.add(contract.employee.id); // Developer
        if (contract.employee.teamLeadId) recipients.add(contract.employee.teamLeadId);
        if (contract.employee.deliveryManagerId) recipients.add(contract.employee.deliveryManagerId);
        if (contract.employee.vicePresidentId) recipients.add(contract.employee.vicePresidentId);
        if (contract.project.salesOwnerId) recipients.add(contract.project.salesOwnerId);

        for (const recipientId of recipients) {
          await this.prisma.notification.create({
            data: {
              recipientId,
              message,
              type: NotificationType.CONTRACT_REMINDER,
            },
          });
          createdCount++;
        }

        // Also update contract status to EXPIRING_SOON if it's ending within 15 days
        if (offset <= 15 && contract.status === 'ACTIVE') {
          await this.prisma.contract.update({
            where: { id: contract.id },
            data: { status: 'EXPIRING_SOON' },
          });
        }
      }
    }

    return { message: `Cron execution complete. Generated ${createdCount} notification reminders.` };
  }
}
