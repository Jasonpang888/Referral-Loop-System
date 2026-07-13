import Layout from "@/components/Layout";
import { useGetCommissions, usePayCommission, useDisputeCommission, getGetCommissionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommissionStatusChip, CommissionTypeChip } from "@/components/StageChip";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function PayoutsPage() {
  const [statusFilter, setStatusFilter] = useState("approved");
  const { data, isLoading } = useGetCommissions({ status: statusFilter, limit: 50 });
  const payComm = usePayCommission();
  const disputeComm = useDisputeCommission();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [payoutRefs, setPayoutRefs] = useState<Record<number, string>>({});

  const handlePay = (id: number) => {
    const ref = payoutRefs[id];
    if (!ref) { toast({ title: "Enter payout reference | 请输入付款参考号", variant: "destructive" }); return; }
    payComm.mutate({ id, data: { payoutReference: ref, auditNote: "Paid via admin dashboard" } as any }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCommissionsQueryKey() }); toast({ title: "Commission marked as paid | 佣金已标记为已付款" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const handleDispute = (id: number) => {
    disputeComm.mutate({ id, data: { auditNote: "Disputed via admin dashboard" } as any }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCommissionsQueryKey() }); toast({ title: "Commission disputed | 佣金已标记为有争议" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">Payouts | 结算管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage commission payouts | 管理佣金结算</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {["pending", "approved", "paid", "disputed", "rejected"].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)}>
              {s === "pending" ? "Pending | 待处理" : s === "approved" ? "Approved | 已批准" : s === "paid" ? "Paid | 已付款" : s === "disputed" ? "Disputed | 有争议" : "Rejected | 已拒绝"}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading... | 加载中...</p>
        ) : (
          <div className="space-y-3">
            {(data?.commissions ?? []).length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No commissions in this status | 此状态下没有佣金记录</p>
            )}
            {(data?.commissions ?? []).map((c) => (
              <Card key={c.id}>
                <CardContent className="py-4 px-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{c.partnerName}</span>
                        <CommissionStatusChip status={c.status} />
                        <CommissionTypeChip type={c.commissionType} />
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">Lead: {c.leadName} · Commission: <strong className="text-foreground">RM{Number(c.amount).toFixed(2)}</strong></div>
                      {c.netSaleAmount && <div className="text-xs text-muted-foreground">Net Sale: RM{Number(c.netSaleAmount).toFixed(2)}{c.commissionRate ? ` @ ${c.commissionRate}%` : ""}</div>}
                      {c.payoutReference && <div className="text-xs text-primary">Ref: {c.payoutReference}</div>}
                      {c.auditNote && <div className="text-xs text-muted-foreground italic">Note: {c.auditNote}</div>}
                    </div>
                    {(c.status === "approved" || c.status === "pending") && (
                      <div className="flex gap-2 items-center flex-shrink-0">
                        <Input
                          placeholder="Payout ref # | 付款参考号"
                          className="w-36 text-xs h-8"
                          value={payoutRefs[c.id] ?? ""}
                          onChange={e => setPayoutRefs(r => ({ ...r, [c.id]: e.target.value }))}
                        />
                        <Button size="sm" onClick={() => handlePay(c.id)} disabled={payComm.isPending}>Pay | 付款</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDispute(c.id)} disabled={disputeComm.isPending}>Dispute | 争议</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
