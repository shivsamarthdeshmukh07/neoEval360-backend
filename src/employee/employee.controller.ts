import { Controller, Get, Body, Put, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  findAll(
    @Query('role') role?: Role,
    @Query('department') department?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.employeeService.findAll({ role, department, status, search });
  }

  @Get('hierarchy/tree')
  getHierarchyTree() {
    return this.employeeService.getHierarchyTree();
  }

  @Get('profile')
  getProfile(@Req() req: any) {
    return this.employeeService.findOne(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeeService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateEmployeeDto, @Req() req: any) {
    return this.employeeService.update(id, updateDto, req.user);
  }

  @Delete(':id')
  @Roles(Role.AUDIT)
  remove(@Param('id') id: string) {
    return this.employeeService.remove(id);
  }
}
