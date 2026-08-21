import { Controller, Get, Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService){}
  async summary(){
    const org = await this.prisma.organization.findFirst();
    if(!org) return {kpis:{totalSales:0,inventoryValue:0,products:0,lowStock:0},salesTrend:[],branchPerformance:[]};
    const [sales,products,branches]=await Promise.all([
      this.prisma.sale.findMany({where:{organizationId:org.id,status:"COMPLETED"}}),
      this.prisma.product.findMany({where:{organizationId:org.id}}),
      this.prisma.branch.findMany({where:{organizationId:org.id}})
    ]);
    const totalSales=sales.reduce((s,x)=>s+Number(x.totalAmount),0);
    const inventoryValue=products.reduce((s,x)=>s+Number(x.unitPrice)*x.stockQuantity,0);
    const lowStock=products.filter(x=>x.stockQuantity<=x.reorderLevel).length;
    const days=new Map<string,number>();
    sales.forEach(x=>{const k=x.soldAt.toISOString().slice(0,10);days.set(k,(days.get(k)||0)+Number(x.totalAmount));});
    const salesTrend=[...days.entries()].sort().map(([date,amount])=>({date,amount}));
    const branchPerformance=branches.map(b=>({branch:b.name,amount:sales.filter(s=>s.branchId===b.id).reduce((a,s)=>a+Number(s.totalAmount),0)}));
    return {kpis:{totalSales,inventoryValue,products:products.length,lowStock},salesTrend,branchPerformance};
  }
}
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService){}
  @Get("summary") summary(){return this.dashboard.summary();}
}
