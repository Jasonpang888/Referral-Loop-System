export const CANONICAL_ROLES = [
  "super_admin",
  "brand_admin",
  "outlet_staff",
  "finance",
  "partner_admin",
  "partner_staff",
] as const;

export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

export const ROLE_ALIASES: Record<string, CanonicalRole> = {
  admin: "super_admin",
  brand_staff: "outlet_staff",
  zhengji_staff: "outlet_staff",
  kiri_partner: "partner_admin",
  partner: "partner_staff",
};

export function normalizeRole(role: string): CanonicalRole | string {
  return ROLE_ALIASES[role] ?? role;
}

export function roleMatches(actualRole: string, allowedRoles: string[]): boolean {
  const actual = normalizeRole(actualRole);
  if (actual === "super_admin") return true;
  return allowedRoles.map(normalizeRole).includes(actual);
}

export const LEAD_STAGES = [
  "new_lead",
  "contacted",
  "appointment_booked",
  "arrived",
  "free_consultation_only",
  "first_paid_treatment",
  "package_purchased",
  "repeat_customer",
  "invalid",
  "cancelled",
  "invalid_cancelled",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export type CommissionType = "flat_rm30" | "package_percent";

export interface CampaignCommissionConfig {
  flatRewardAmount?: string | number | null;
  packageCommissionMin?: string | number | null;
  packageCommissionMax?: string | number | null;
}

export interface CommissionCalculationInput {
  paymentType: string;
  netSaleAmount?: string | number | null;
  commissionType?: CommissionType | null;
  commissionRate?: string | number | null;
  campaign?: CampaignCommissionConfig | null;
}

export interface CommissionCalculation {
  amount: number;
  commissionType: CommissionType;
  commissionRate: number | null;
  netSaleAmount: number;
  leadStage: "first_paid_treatment" | "package_purchased";
}

const NO_COMMISSION_STAGES = new Set([
  "free_consultation_only",
  "repeat_customer",
  "invalid",
  "cancelled",
  "invalid_cancelled",
]);

export function normalizeMobile(value: string): string {
  return value.replace(/[\s().-]/g, "").trim();
}

export function normalizeMembershipId(value?: string | null): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

export function isPayableStage(stage: string): boolean {
  return stage === "first_paid_treatment" || stage === "package_purchased";
}

export function isNoCommissionStage(stage: string): boolean {
  return NO_COMMISSION_STAGES.has(stage);
}

function toMoneyNumber(value: string | number | null | undefined, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCommission(input: CommissionCalculationInput): CommissionCalculation | null {
  if (isNoCommissionStage(input.paymentType)) return null;
  if (!isPayableStage(input.paymentType)) {
    throw new Error("Commission can only be created for first paid treatment or package purchase");
  }

  const netSaleAmount = toMoneyNumber(input.netSaleAmount);
  if (netSaleAmount <= 0) {
    throw new Error("Net sale amount must be greater than zero");
  }

  const requestedType: CommissionType =
    input.commissionType ?? (input.paymentType === "package_purchased" ? "package_percent" : "flat_rm30");

  if (requestedType === "package_percent") {
    const minRate = toMoneyNumber(input.campaign?.packageCommissionMin, 8);
    const maxRate = toMoneyNumber(input.campaign?.packageCommissionMax, 10);
    const rate = toMoneyNumber(input.commissionRate);
    if (rate < minRate || rate > maxRate) {
      throw new Error(`Package commission rate must be between ${minRate}% and ${maxRate}%`);
    }

    return {
      amount: roundMoney((netSaleAmount * rate) / 100),
      commissionType: "package_percent",
      commissionRate: rate,
      netSaleAmount,
      leadStage: "package_purchased",
    };
  }

  return {
    amount: roundMoney(toMoneyNumber(input.campaign?.flatRewardAmount, 30)),
    commissionType: "flat_rm30",
    commissionRate: null,
    netSaleAmount,
    leadStage: input.paymentType === "package_purchased" ? "package_purchased" : "first_paid_treatment",
  };
}

export function assertCommissionCanBeCreated(params: {
  leadCommissionId?: number | null;
  existingCommissionCount: number;
  currentStage?: string | null;
}): void {
  if (params.leadCommissionId || params.existingCommissionCount > 0) {
    throw new Error("Commission already exists for this lead");
  }
  if (params.currentStage === "repeat_customer") {
    throw new Error("Repeat customers cannot create a new referral reward");
  }
}
