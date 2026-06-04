import { PrismaClient, Role, EmployeeStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Clean DB
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.continuousFeedback.deleteMany({});
  await prisma.performanceEvaluation.deleteMany({});
  await prisma.evaluationCycle.deleteMany({});
  await prisma.contract.deleteMany({});
  await prisma.trial.deleteMany({});
  await prisma.resourceAllocation.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash('Welcome@123', 10);

  // 1. Audit (Super Admin)
  const audit = await prisma.user.create({
    data: {
      employeeId: 'EMP-AUDIT-001',
      email: 'audit@neoeval360.com',
      passwordHash,
      fullName: 'System Auditor',
      designation: 'Super Administrator',
      department: 'Audit',
      joiningDate: new Date('2025-01-01T00:00:00Z'),
      role: Role.AUDIT,
      status: EmployeeStatus.CONFIRMED,
      experienceYears: 10.0,
      skills: [],
      certifications: [],
    },
  });

  // 2. VP (Admin)
  const vp = await prisma.user.create({
    data: {
      employeeId: 'EMP-VP-001',
      email: 'vp@neoeval360.com',
      passwordHash,
      fullName: 'Vincent Paul',
      designation: 'Vice President of Delivery',
      department: 'Delivery',
      joiningDate: new Date('2025-02-01T00:00:00Z'),
      role: Role.VP,
      status: EmployeeStatus.CONFIRMED,
      experienceYears: 15.0,
      skills: [],
      certifications: [],
    },
  });

  // 3. DM (Delivery Manager) reports to VP
  const dm = await prisma.user.create({
    data: {
      employeeId: 'EMP-DM-001',
      email: 'dm@neoeval360.com',
      passwordHash,
      fullName: 'Daniel Miller',
      designation: 'Delivery Manager',
      department: 'Delivery',
      joiningDate: new Date('2025-03-01T00:00:00Z'),
      role: Role.DM,
      status: EmployeeStatus.CONFIRMED,
      experienceYears: 8.0,
      vicePresidentId: vp.id,
      skills: [],
      certifications: [],
    },
  });

  // 4. TL (Team Lead) reports to DM and VP
  const tl = await prisma.user.create({
    data: {
      employeeId: 'EMP-TL-001',
      email: 'tl@neoeval360.com',
      passwordHash,
      fullName: 'Tanya Lopez',
      designation: 'Technical Team Lead',
      department: 'Delivery',
      joiningDate: new Date('2025-04-01T00:00:00Z'),
      role: Role.TL,
      status: EmployeeStatus.CONFIRMED,
      experienceYears: 5.0,
      deliveryManagerId: dm.id,
      vicePresidentId: vp.id,
      skills: [],
      certifications: [],
    },
  });

  // 5. Dev (Developer) reports to TL, DM, and VP
  const dev = await prisma.user.create({
    data: {
      employeeId: 'EMP-DEV-001',
      email: 'dev@neoeval360.com',
      passwordHash,
      fullName: 'Devin Smith',
      designation: 'Frontend Developer',
      department: 'Delivery',
      joiningDate: new Date('2025-05-01T00:00:00Z'),
      role: Role.DEV,
      status: EmployeeStatus.TRIAL,
      skills: ['TypeScript', 'React', 'CSS'],
      experienceYears: 2.0,
      teamLeadId: tl.id,
      deliveryManagerId: dm.id,
      vicePresidentId: vp.id,
      certifications: [],
    },
  });

  // 6. Sales Head
  const salesHead = await prisma.user.create({
    data: {
      employeeId: 'EMP-SH-001',
      email: 'saleshead@neoeval360.com',
      passwordHash,
      fullName: 'Sarah Harris',
      designation: 'Head of Sales',
      department: 'Sales',
      joiningDate: new Date('2025-02-15T00:00:00Z'),
      role: Role.SALES_HEAD,
      status: EmployeeStatus.CONFIRMED,
      experienceYears: 12.0,
      skills: [],
      certifications: [],
    },
  });

  // 7. Sales rep reports to Sales Head
  const sales = await prisma.user.create({
    data: {
      employeeId: 'EMP-SALES-001',
      email: 'sales@neoeval360.com',
      passwordHash,
      fullName: 'Samuel Owens',
      designation: 'Sales Executive',
      department: 'Sales',
      joiningDate: new Date('2025-03-15T00:00:00Z'),
      role: Role.SALES,
      status: EmployeeStatus.CONFIRMED,
      experienceYears: 4.0,
      parentSalesHeadId: salesHead.id,
      skills: [],
      certifications: [],
    },
  });

  console.log('Seeding completed successfully!');
  console.log({
    audit: audit.email,
    vp: vp.email,
    dm: dm.email,
    tl: tl.email,
    dev: dev.email,
    salesHead: salesHead.email,
    sales: sales.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
