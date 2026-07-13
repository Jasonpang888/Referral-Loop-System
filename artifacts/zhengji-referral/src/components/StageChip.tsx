import { cn } from "@/lib/utils";

const STAGE_CONFIG: Record<string, { label: string; labelZh: string; className: string }> = {
  new_lead: { label: "New Lead", labelZh: "新客", className: "bg-blue-100 text-blue-800 border-blue-200" },
  contacted: { label: "Contacted", labelZh: "已联系", className: "bg-sky-100 text-sky-800 border-sky-200" },
  appointment_booked: { label: "Appt Booked", labelZh: "已预约", className: "bg-purple-100 text-purple-800 border-purple-200" },
  arrived: { label: "Arrived", labelZh: "已到访", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  free_consultation_only: { label: "Free Consult", labelZh: "仅免费咨询", className: "bg-orange-100 text-orange-800 border-orange-200" },
  first_paid_treatment: { label: "First Paid", labelZh: "首次付费", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  package_purchased: { label: "Package", labelZh: "购买套餐", className: "bg-green-100 text-green-800 border-green-200" },
  repeat_customer: { label: "Repeat", labelZh: "复诊", className: "bg-stone-100 text-stone-700 border-stone-200" },
  invalid: { label: "Invalid", labelZh: "无效", className: "bg-gray-100 text-gray-600 border-gray-200" },
  cancelled: { label: "Cancelled", labelZh: "已取消", className: "bg-gray-100 text-gray-600 border-gray-200" },
  invalid_cancelled: { label: "Invalid", labelZh: "无效取消", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const STATUS_CONFIG: Record<string, { label: string; labelZh: string; className: string }> = {
  pending: { label: "Pending", labelZh: "待处理", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  approved: { label: "Approved", labelZh: "已批准", className: "bg-blue-100 text-blue-800 border-blue-200" },
  paid: { label: "Paid", labelZh: "已付款", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  disputed: { label: "Disputed", labelZh: "有争议", className: "bg-orange-100 text-orange-800 border-orange-200" },
  rejected: { label: "Rejected", labelZh: "已拒绝", className: "bg-red-100 text-red-800 border-red-200" },
};

export function StageChip({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage];
  if (!cfg) return <span className="text-xs text-muted-foreground">{stage}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium", cfg.className)}>
      {cfg.label} <span className="opacity-70">| {cfg.labelZh}</span>
    </span>
  );
}

export function CommissionStatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return <span className="text-xs text-muted-foreground">{status}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium", cfg.className)}>
      {cfg.label} <span className="opacity-70">| {cfg.labelZh}</span>
    </span>
  );
}

export function CommissionTypeChip({ type }: { type: string }) {
  if (type === "flat_rm30") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium bg-accent/10 text-accent border-accent/20">RM30 Flat | 固定RM30</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium bg-primary/10 text-primary border-primary/20">% Package | 套餐%</span>;
}
