import Layout from "@/components/Layout";
import {
  useGetPayoutBatches, useCreatePayoutBatch, getGetPayoutBatchesQueryKey,
  useGetCommissions,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BatchStatusChip, CommissionTypeChip } from "@/components/StageChip";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function BatchesPage() {
  const [statusFilter, setStatusFilter] = useState("draft");
  const { data, isLoading } = useGetPayoutBatches({ status: statusFilter || undefined, limit: 50 });
  const createBatch = useCreatePayoutBatch();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [showForm, setShowForm] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: candidates, isLoading: candidatesLoading } = useGetCommissions(
    { status: "approved", unbatched: true, limit: 100 },
    { query: { enabled: showForm } }
  );

  const toggleSelected = (id: number) => {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedTotal = (candidates?.commissions ?? [])
    .filter(c => selected.has(c.id))
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const resetForm = () => {
    setPeriodStart("");
    setPeriodEnd("");
    setSelected(new Set());
    setShowForm(false);
  };

  const handleCreate = () => {
    if (!periodStart || !periodEnd) {
      toast({ title: "Select a period start and end date | 请选择结算周期起止日期", variant: "destructive" });
      return;
    }
    if (selected.size === 0) {
      toast({ title: "Select at least one commission | 请至少选择一条佣金记录", variant: "destructive" });
      return;
    }
    createBatch.mutate({ data: { periodStart, periodEnd, commissionIds: [...selected] } }, {
      onSuccess: (batch) => {
        qc.invalidateQueries({ queryKey: getGetPayoutBatchesQueryKey() });
        toast({ title: `Batch ${batch.reference} created | 批次 ${batch.reference} 已创建` });
        resetForm();
        setLocation(`/finance/batches/${batch.id}`);
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Error creating batch", variant: "destructive" }),
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-primary">Payout Batches | 月结批次</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Group approved commissions into a monthly settlement run | 把已批准的佣金汇总成一批月结付款</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel | 取消" : "New Batch | 新建批次"}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">Create Payout Batch | 创建月结批次</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Period Start | 结算周期开始</Label>
                  <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Period End | 结算周期结束</Label>
                  <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Approved commissions not yet batched | 已批准但未入批次的佣金</Label>
                {candidatesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading... | 加载中...</p>
                ) : (candidates?.commissions ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No approved commissions waiting to be batched | 暂无待入批次的已批准佣金</p>
                ) : (
                  <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                    {(candidates?.commissions ?? []).map(c => (
                      <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer text-sm">
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelected(c.id)} />
                        <span className="flex-1 min-w-0">
                          <span className="font-medium">{c.partnerName}</span>
                          <span className="text-muted-foreground"> · {c.leadName}</span>
                        </span>
                        <CommissionTypeChip type={c.commissionType} />
                        <span className="font-medium w-20 text-right">RM{Number(c.amount).toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">{selected.size} selected | 已选{selected.size}条 · Total | 总计: <strong className="text-foreground">RM{selectedTotal.toFixed(2)}</strong></span>
                <Button onClick={handleCreate} disabled={createBatch.isPending}>
                  {createBatch.isPending ? "Creating..." : "Create Batch | 创建批次"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 flex-wrap">
          {["draft", "paid", "cancelled"].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)}>
              {s === "draft" ? "Draft | 草稿" : s === "paid" ? "Paid | 已付款" : "Cancelled | 已取消"}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading... | 加载中...</p>
        ) : (
          <div className="space-y-3">
            {(data?.batches ?? []).length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No batches in this status | 此状态下没有批次</p>
            )}
            {(data?.batches ?? []).map(b => (
              <Card key={b.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setLocation(`/finance/batches/${b.id}`)}>
                <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-primary">{b.reference}</span>
                      <BatchStatusChip status={b.status} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">{b.periodStart} → {b.periodEnd} · {b.commissionCount} commissions | {b.commissionCount}条佣金</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">RM{b.totalAmount.toFixed(2)}</div>
                    {b.paidAt && <div className="text-xs text-muted-foreground">Paid {new Date(b.paidAt).toLocaleDateString("zh-CN")}</div>}
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
