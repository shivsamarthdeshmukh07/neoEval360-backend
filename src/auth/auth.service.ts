import { ConflictException, Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto, creator?: { fullName: string; email: string }) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: registerDto.email },
          { employeeId: registerDto.employeeId },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email or Employee ID already exists');
    }

    const defaultPassword = `${registerDto.employeeId}@123`;
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const parsedJoiningDate = new Date(registerDto.joiningDate);
    if (isNaN(parsedJoiningDate.getTime())) {
      throw new BadRequestException('Invalid joining date format');
    }

    // Verify parent references if provided
    if (registerDto.parentSalesHeadId) {
      const parent = await this.prisma.user.findUnique({ where: { id: registerDto.parentSalesHeadId } });
      if (!parent || parent.role !== 'SALES_HEAD') {
        throw new BadRequestException('Invalid parent Sales Head selection');
      }
    }
    if (registerDto.teamLeadId) {
      const parent = await this.prisma.user.findUnique({ where: { id: registerDto.teamLeadId } });
      if (!parent || parent.role !== 'TL') {
        throw new BadRequestException('Invalid Team Lead selection');
      }
    }
    if (registerDto.deliveryManagerId) {
      const parent = await this.prisma.user.findUnique({ where: { id: registerDto.deliveryManagerId } });
      if (!parent || parent.role !== 'DM') {
        throw new BadRequestException('Invalid Delivery Manager selection');
      }
    }
    if (registerDto.vicePresidentId) {
      const parent = await this.prisma.user.findUnique({ where: { id: registerDto.vicePresidentId } });
      if (!parent || parent.role !== 'VP') {
        throw new BadRequestException('Invalid Vice President selection');
      }
    }

    const newUser = await this.prisma.user.create({
      data: {
        employeeId: registerDto.employeeId,
        email: registerDto.email,
        passwordHash,
        fullName: registerDto.fullName,
        designation: registerDto.designation,
        department: registerDto.department,
        joiningDate: parsedJoiningDate,
        role: registerDto.role,
        status: registerDto.status || 'TRIAL',
        skills: registerDto.skills || [],
        experienceYears: registerDto.experienceYears || 0,
        certifications: registerDto.certifications || [],
        parentSalesHeadId: registerDto.parentSalesHeadId,
        teamLeadId: registerDto.teamLeadId,
        deliveryManagerId: registerDto.deliveryManagerId,
        vicePresidentId: registerDto.vicePresidentId,
        active: true,
      },
    });

    // Omit password from return
    const { passwordHash: _, ...result } = newUser;

    // Send welcome email asynchronously
    this.mailService.sendWelcomeEmail(
      newUser.email,
      newUser.fullName,
      newUser.employeeId,
      defaultPassword,
      creator,
    ).catch(err => {
      console.error(`Failed to send welcome email to ${newUser.email}:`, err);
    });

    return {
      message: `Employee registered successfully. Default password is '${defaultPassword}'`,
      user: result,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials or inactive account');
    }

    const passwordMatches = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        employeeId: user.employeeId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    };
  }
}
