import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationType } from '@prisma/client';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

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
              email: true,
              teamLead: { select: { id: true, email: true, fullName: true } },
              deliveryManager: { select: { id: true, email: true, fullName: true } },
              vicePresident: { select: { id: true, email: true, fullName: true } },
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              salesOwner: { select: { id: true, email: true, fullName: true } },
            },
          },
        },
      });

      for (const trial of trials) {
        const timeLabel = offset === 0 ? 'today' : `in ${offset} days`;
        const message = `Trial period for ${trial.employee.fullName} in project '${trial.project.name}' is ending ${timeLabel} (on ${trial.trialEndDate.toISOString().split('T')[0]}). Please complete reviews.`;

        const recipients = new Map<string, { email: string; fullName: string }>();
        recipients.set(trial.employee.id, { email: trial.employee.email, fullName: trial.employee.fullName });
        if (trial.employee.teamLead) {
          recipients.set(trial.employee.teamLead.id, { email: trial.employee.teamLead.email, fullName: trial.employee.teamLead.fullName });
        }
        if (trial.employee.deliveryManager) {
          recipients.set(trial.employee.deliveryManager.id, { email: trial.employee.deliveryManager.email, fullName: trial.employee.deliveryManager.fullName });
        }
        if (trial.employee.vicePresident) {
          recipients.set(trial.employee.vicePresident.id, { email: trial.employee.vicePresident.email, fullName: trial.employee.vicePresident.fullName });
        }
        if (trial.project.salesOwner) {
          recipients.set(trial.project.salesOwner.id, { email: trial.project.salesOwner.email, fullName: trial.project.salesOwner.fullName });
        }

        for (const [recipientId, info] of recipients.entries()) {
          await this.prisma.notification.create({
            data: {
              recipientId,
              message,
              type: NotificationType.TRIAL_REMINDER,
            },
          });

          this.mailService.sendExpirationReminderEmail(
            info.email,
            info.fullName,
            'trial',
            message,
          ).catch(err => {
            console.error(`Failed to send trial reminder email to ${info.email}:`, err);
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
              email: true,
              teamLead: { select: { id: true, email: true, fullName: true } },
              deliveryManager: { select: { id: true, email: true, fullName: true } },
              vicePresident: { select: { id: true, email: true, fullName: true } },
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              salesOwner: { select: { id: true, email: true, fullName: true } },
            },
          },
        },
      });

      for (const contract of contracts) {
        const timeLabel = offset === 0 ? 'today' : `in ${offset} days`;
        const message = `Contract for ${contract.employee.fullName} in project '${contract.project.name}' is ending ${timeLabel} (on ${contract.contractEndDate.toISOString().split('T')[0]}). Please review renewals.`;

        const recipients = new Map<string, { email: string; fullName: string }>();
        recipients.set(contract.employee.id, { email: contract.employee.email, fullName: contract.employee.fullName });
        if (contract.employee.teamLead) {
          recipients.set(contract.employee.teamLead.id, { email: contract.employee.teamLead.email, fullName: contract.employee.teamLead.fullName });
        }
        if (contract.employee.deliveryManager) {
          recipients.set(contract.employee.deliveryManager.id, { email: contract.employee.deliveryManager.email, fullName: contract.employee.deliveryManager.fullName });
        }
        if (contract.employee.vicePresident) {
          recipients.set(contract.employee.vicePresident.id, { email: contract.employee.vicePresident.email, fullName: contract.employee.vicePresident.fullName });
        }
        if (contract.project.salesOwner) {
          recipients.set(contract.project.salesOwner.id, { email: contract.project.salesOwner.email, fullName: contract.project.salesOwner.fullName });
        }

        for (const [recipientId, info] of recipients.entries()) {
          await this.prisma.notification.create({
            data: {
              recipientId,
              message,
              type: NotificationType.CONTRACT_REMINDER,
            },
          });

          this.mailService.sendExpirationReminderEmail(
            info.email,
            info.fullName,
            'contract',
            message,
          ).catch(err => {
            console.error(`Failed to send contract reminder email to ${info.email}:`, err);
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
