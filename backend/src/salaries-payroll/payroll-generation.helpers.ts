import { Prisma } from '@prisma/client';

/** Config snapshot shape stored on PayrollRun (see payroll-config buildConfigSnapshot). */
export type PayrollConfigSnapshot = {
  count_bonus_enabled?: boolean | null;
  count_bonus_amount?: number | null;
  revenue_bonus_enabled?: boolean | null;
  revenue_bonus_amount?: number | null;
  deduction_per_order?: number | null;
  orders_deduction_tiers?: unknown;
  revenue_deduction_tiers?: unknown;
  revenue_unit_amount?: number | null;
};

export function computeConfigBonuses(
  snapshot: PayrollConfigSnapshot,
  targetType: string | null | undefined,
  ordersCount: number,
  totalRevenue: number,
  monthlyOrdersTarget: number,
  monthlyRevenueTarget: number,
): number {
  let bonus = 0;
  if (
    targetType === 'TARGET_TYPE_ORDERS' &&
    snapshot.count_bonus_enabled &&
    snapshot.count_bonus_amount != null &&
    ordersCount >= monthlyOrdersTarget
  ) {
    bonus += Number(snapshot.count_bonus_amount);
  }
  if (
    targetType === 'TARGET_TYPE_REVENUE' &&
    snapshot.revenue_bonus_enabled &&
    snapshot.revenue_bonus_amount != null &&
    totalRevenue >= monthlyRevenueTarget
  ) {
    bonus += Number(snapshot.revenue_bonus_amount);
  }
  return bonus;
}

export function addOneMonthUTC(monthStart: Date): Date {
  const d = new Date(monthStart);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}

export type Tx = Prisma.TransactionClient;
