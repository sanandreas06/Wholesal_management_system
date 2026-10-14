import { Module } from "@nestjs/common";
import { ExpensesService } from "./expenses.service";
import { DepositsService } from "./deposits.service";
import { ReconciliationService } from "./reconciliation.service";
import { ExpenseCategoriesController, ExpensesController, DepositsController, ReconciliationController, BranchClosingsController, VarianceCasesController } from "./finance.controllers";

@Module({
  controllers: [ExpenseCategoriesController, ExpensesController, DepositsController, ReconciliationController, BranchClosingsController, VarianceCasesController],
  providers: [ExpensesService, DepositsService, ReconciliationService]
})
export class FinanceModule {}
