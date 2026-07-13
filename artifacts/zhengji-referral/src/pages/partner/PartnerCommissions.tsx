import Layout from "@/components/Layout";
import { useGetPartnerCommissions } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { CommissionStatusChip, CommissionTypeChip } from "@/components/StageChip";
import { useState } from "react";

export default function PartnerCommissions() {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetPartnerCommissions({ status: statusFilter || undefined, page });

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">My Commissions | 我的佣金</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your referral earnings | 追踪您的推荐收入</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {["", "pending", "approved", "paid", "disputed"].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => { setStatusFilter(s); setPage(1); }}>
              {s === "" ? "All | 全部" : s === "pending" ? "Pending | 待处理" : s === "approved" ? "Approved | 已批准" : s === "paid" ? "Paid | 已付款" : "Disputed | 有争议"}
            </Button>
          ))}
        </div>

        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground text-xs">
                <th className="text-left py-3 px-4">Lead | 客户</th>
                <th className="text-left py-3 px-4">Type | 类型</th>
                <th className="text-right py-3 px-4">Amount | 金额</th>
                <th className="text-left py-3 px-4">Status | 状态</th>
                <th className="text-left py-3 px-4">Payout Ref | 付款参考</th>
                <th className="text-left py-3 px-4">Date | 日期</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Loading... | 加载中...</td></tr>}
              {(data?.commissions ?? []).map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="py-3 px-4 font-medium">{c.leadName}</td>
                  <td className="py-3 px-4"><CommissionTypeChip type={c.commissionType} /></td>
                  <td className="py-3 px-4 text-right font-semibold text-primary">RM{Number(c.amount).toFixed(2)}</td>
                  <td className="py-3 px-4"><CommissionStatusChip status={c.status} /></td>
                  <td className="py-3 px-4 text-xs text-muted-foreground font-mono">{c.payoutReference ?? "—"}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("zh-CN")}</td>
                </tr>
              ))}
              {!isLoading && (data?.commissions ?? []).length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No commissions yet | 暂无佣金记录</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        {data && data.commissions.length > 0 && (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-card border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Pending | 待处理</p>
              <p className="font-bold text-lg text-yellow-600">RM{data.commissions.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0).toFixed(2)}</p>
            </div>
            <div className="bg-card border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Approved | 已批准</p>
              <p className="font-bold text-lg text-blue-600">RM{data.commissions.filter(c => c.status === "approved").reduce((s, c) => s + Number(c.amount), 0).toFixed(2)}</p>
            </div>
            <div className="bg-card border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Paid | 已付款</p>
              <p className="font-bold text-lg text-emerald-600">RM{data.commissions.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0).toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
