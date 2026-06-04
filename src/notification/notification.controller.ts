import { Controller, Get, Put, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAllForUser(@Req() req: any) {
    return this.notificationService.findAllForUser(req.user.id);
  }

  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationService.markAsRead(id, req.user.id);
  }

  @Get('cron/reminders')
  triggerCron(@Req() req: any) {
    const authHeader = req.headers.authorization;
    let secret = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      secret = authHeader.substring(7);
    } else {
      secret = (req.query.secret as string) || '';
    }
    return this.notificationService.triggerReminderCron(secret);
  }
}
