import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { ExtendContractDto } from './dto/extend-contract.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @Roles(Role.AUDIT, Role.SALES, Role.SALES_HEAD)
  create(@Body() createContractDto: CreateContractDto) {
    return this.contractService.create(createContractDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.contractService.findAll(req.user);
  }

  @Get('extensions/pending')
  @Roles(Role.DM, Role.VP)
  findPendingExtensions(@Req() req: any) {
    return this.contractService.findPendingExtensions(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractService.findOne(id);
  }

  @Post(':id/extensions')
  @Roles(Role.SALES, Role.SALES_HEAD)
  requestExtension(
    @Param('id') id: string,
    @Body() extendContractDto: ExtendContractDto,
    @Req() req: any,
  ) {
    return this.contractService.requestExtension(id, extendContractDto, req.user.id);
  }

  @Put(':id/extensions/approve-dm')
  @Roles(Role.DM)
  approveDM(@Param('id') id: string) {
    return this.contractService.approveDM(id);
  }

  @Put(':id/extensions/approve-vp')
  @Roles(Role.VP)
  approveVP(@Param('id') id: string) {
    return this.contractService.approveVP(id);
  }

  @Put(':id/extensions/reject')
  @Roles(Role.DM, Role.VP)
  rejectExtension(@Param('id') id: string) {
    return this.contractService.rejectExtension(id);
  }
}
