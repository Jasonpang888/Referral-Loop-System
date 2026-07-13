import Layout from "@/components/Layout";
import { useGetCommissions, useApproveCommission, useRejectCommission, getGetCommissionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommissionStatusChip, CommissionTypeChip } from "@/components/StageChip";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function StaffCommissions() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetCommissions({ status: statusFilter || undefined, page, limit: 20 });
  const approveComm = useApproveCommission();
  const rejectComm = useRejectCommission();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [auditNotes, setAuditNotes] = useState<Record<number, string>>({});

  const handleApprove = (id: number) => {
    approveComm.mutate({ id, data: { auditNote: auditNotes[id] ?? null } as any }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCommissionsQueryKey() }); toast({ title: "Commission approved | 佣金已批准" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const handleReject = (id: number) => {
    rejectComm.mutate({ id, data: { auditNote: auditNotes[id] ?? null } as any }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCommissionsQueryKey() }); toast({ title: "Commission rejected | 佣金已拒绝" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">Commission Approval | 佣金审批</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review and approve partner commissions | 审核并批准合作伙伴佣金</p>
        </div>

        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-muted-foreground">
          <strong>Rule | 规则:</strong> RM30 reward triggers ONLY on first paid treatment — no repeat-visit commissions. Package % is alternative, never combined. | RM30奖励仅在首次付费治疗时触发，复诊不计佣金。套餐%为替代方案，不可同时发放。
        </div>

        <div className="flex gap-2 flex-wrap">
          {["pending", "approved", "paid", "disputed", "rejected"].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => { setStatusFilter(s); setPage(1); }}>
              {s === "pending" ? "Pending | 待审" : s === "approved" ? "Approved | 已批" : s === "paid" ? "Paid | 已付" : s === "disputed" ? "Disputed | 争议" : "Rejected | 拒绝"}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {isLoading && <p className="text-muted-foreground text-sm">Loading... | 加载中...</p>}
          {(data?.commissions ?? []).length === 0 && !isLoading && (
            <p className="text-center py-8 text-muted-foreground text-sm">No commissions | 暂无佣金记录</p>
          )}
          {(data?.commissions ?? []).map((c) => (
            <Card key={c.id}>
              <CardContent className="py-4 px-5">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold">{c.partnerName}</span>
                      <CommissionStatusChip status={c.status} />
                      <CommissionTypeChip type={c.commissionType} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Lead: <strong className="text-foreground">{c.leadName}</strong> · Amount: <strong className="text-foreground">RM{Number(c.amount).toFixed(2)}</strong>
                    </div>
                    {c.netSaleAmount && (
                      <div className="text-xs text-muted-foreground mt-0.5">Net Sale: RM{Number(c.netSaleAmount).toFixed(2)}{c.commissionRate ? ` @ ${c.commissionRate}%` : ""}</div>
                    )}
                    {c.proofUrl && <div className="text-xs text-primary mt-0.5"><a href={c.proofUrl} target="_blank" rel="noopener noreferrer">View Proof | 查看凭证</a></div>}
                    {c.auditNote && <div className="text-xs text-muted-foreground italic mt-0.5">Note: {c.auditNote}</div>}
                    <div className="text-xs text-muted-foreground mt-1">{new Date(c.createdAt).toLocaleDateString("zh-CN")}</div>
                  </div>
                  {c.status === "pending" && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Input
                        className="h-7 text-xs w-52"
                        placeholder="Audit note (optional) | 备注"
                        value={auditNotes[c.id] ?? ""}
                        onChange={e => setAuditNotes(n => ({ ...n, [c.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => handleApprove(c.id)} disabled={approveComm.isPending}>Approve | 批准</Button>
                        <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleReject(c.id)} disabled={rejectComm.isPending}>Reject | 拒绝</Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {data && data.total > 20 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{data.total} total | 共{data.total}条</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev | 上页</Button>
              <Button size="sm" variant="outline" disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}>Next | 下页</Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
