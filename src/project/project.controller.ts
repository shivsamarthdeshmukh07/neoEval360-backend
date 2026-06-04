import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // Clients
  @Post('clients')
  @Roles(Role.AUDIT, Role.SALES, Role.SALES_HEAD)
  createClient(@Body() createClientDto: CreateClientDto) {
    return this.projectService.createClient(createClientDto);
  }

  @Get('clients')
  findAllClients() {
    return this.projectService.findAllClients();
  }

  @Put('clients/:id')
  @Roles(Role.AUDIT, Role.SALES, Role.SALES_HEAD)
  updateClient(@Param('id') id: string, @Body() createClientDto: CreateClientDto) {
    return this.projectService.updateClient(id, createClientDto);
  }

  @Delete('clients/:id')
  @Roles(Role.AUDIT, Role.SALES, Role.SALES_HEAD)
  deleteClient(@Param('id') id: string) {
    return this.projectService.deleteClient(id);
  }

  // Projects
  @Post()
  @Roles(Role.AUDIT, Role.SALES, Role.SALES_HEAD)
  createProject(@Body() createProjectDto: CreateProjectDto) {
    return this.projectService.createProject(createProjectDto);
  }

  @Get()
  findAllProjects(@Req() req: any) {
    return this.projectService.findAllProjects(req.user);
  }

  @Get('allocations/pending')
  @Roles(Role.DM, Role.VP)
  findPendingAllocations(@Req() req: any) {
    return this.projectService.findPendingAllocations(req.user);
  }

  @Get(':id')
  findProjectById(@Param('id') id: string) {
    return this.projectService.findProjectById(id);
  }

  @Put(':id')
  @Roles(Role.AUDIT, Role.SALES, Role.SALES_HEAD)
  updateProject(@Param('id') id: string, @Body() createProjectDto: CreateProjectDto) {
    return this.projectService.updateProject(id, createProjectDto);
  }

  @Delete(':id')
  @Roles(Role.AUDIT)
  deleteProject(@Param('id') id: string) {
    return this.projectService.deleteProject(id);
  }

  // Resource Allocation
  @Post(':projectId/allocations')
  @Roles(Role.DM)
  createAllocation(
    @Param('projectId') projectId: string,
    @Body() createAllocationDto: CreateAllocationDto,
    @Req() req: any,
  ) {
    return this.projectService.createAllocation(projectId, createAllocationDto, req.user.id);
  }

  @Put('allocations/:id/approve')
  @Roles(Role.VP)
  approveAllocation(@Param('id') id: string, @Req() req: any) {
    return this.projectService.approveAllocation(id, req.user.id);
  }

  @Put('allocations/:id/reject')
  @Roles(Role.VP)
  rejectAllocation(@Param('id') id: string, @Req() req: any) {
    return this.projectService.rejectAllocation(id, req.user.id);
  }

  @Delete('allocations/:id')
  @Roles(Role.DM, Role.VP, Role.AUDIT)
  deleteAllocation(@Param('id') id: string, @Req() req: any) {
    return this.projectService.deleteAllocation(id, req.user);
  }
}
