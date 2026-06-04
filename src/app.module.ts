import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { EmployeeModule } from './employee/employee.module';
import { ProjectModule } from './project/project.module';
import { TrialModule } from './trial/trial.module';
import { ContractModule } from './contract/contract.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { NotificationModule } from './notification/notification.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportModule } from './report/report.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    AuthModule,
    EmployeeModule,
    ProjectModule,
    TrialModule,
    ContractModule,
    EvaluationModule,
    NotificationModule,
    DashboardModule,
    ReportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
