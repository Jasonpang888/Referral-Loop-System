import Layout from "@/components/Layout";
import {
  useGetPayoutBatch, useMarkPayoutBatchPaid, useCancelPayoutBatch, useExportPayoutBatch,
  getGetPayoutBatchQueryKey, getGetPayoutBatchesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BatchStatusChip, CommissionStatusChip, CommissionTypeChip } from "@/components/StageChip";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function downloadCSV(csvData: string, filename: string) {
  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const batchId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { data: batch, isLoading } = useGetPayoutBatch(batchId);
  const markPaid = useMarkPayoutBatchPaid();
  const cancelBatch = useCancelPayoutBatch();
  const exportBatch = useExportPayoutBatch(batchId);
  const qc = useQueryClient();
  const { toast } = useToast();

  const [payoutReference, setPayoutReference] = useState("");
  const [auditNote, setAuditNote] = useState("");

  const handleMarkPaid = () => {
    if (!payoutReference) {
      toast({ title: "Enter a payout reference | 请输入付款参考号", variant: "destructive" });
      return;
    }
    markPaid.mutate({ id: batchId, data: { payoutReference, auditNote: auditNote || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPayoutBatchQueryKey(batchId) });
        qc.invalidateQueries({ queryKey: getGetPayoutBatchesQueryKey() });
        toast({ title: "Batch marked as paid | 批次已标记为已付款" });
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Error marking batch paid", variant: "destructive" }),
    });
  };

  const handleCancel = () => {
    cancelBatch.mutate({ id: batchId, data: { auditNote: "Cancelled via finance dashboard" } as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPayoutBatchQueryKey(batchId) });
        qc.invalidateQueries({ queryKey: getGetPayoutBatchesQueryKey() });
        toast({ title: "Batch cancelled — commissions released | 批次已取消，佣金已释放" });
        setLocation("/finance");
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Error cancelling batch", variant: "destructive" }),
    });
  };

  const handleExport = () => {
    if (exportBatch.data) {
      downloadCSV(exportBatch.data.csvData, exportBatch.data.filename);
      toast({ title: `Downloaded ${exportBatch.data.rowCount} rows | 已下载${exportBatch.data.rowCount}行` });
    }
  };

  if (isLoading) return <Layout><div className="p-6 text-muted-foreground">Loading... | 加载中...</div></Layout>;
  if (!batch) return <Layout><div className="p-6 text-destructive">Batch not found | 未找到批次记录</div></Layout>;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => setLocation("/finance")}>← Back | 返回</Button>
          <div>
            <h1 className="text-xl font-serif font-bold text-primary font-mono">{batch.reference}</h1>
            <p className="text-sm text-muted-foreground">{batch.periodStart} → {batch.periodEnd}</p>
          </div>
          <BatchStatusChip status={batch.status} />
        </div>

        <Card>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5">
            <div><span className="text-xs text-muted-foreground">Total | 总额</span><div className="text-xl font-bold">RM{batch.totalAmount.toFixed(2)}</div></div>
            <div><span className="text-xs text-muted-foreground">Commissions | 佣金数</span><div className="text-xl font-bold">{batch.commissionCount}</div></div>
            <div><span className="text-xs text-muted-foreground">Created By | 创建人</span><div className="text-sm mt-1">{batch.createdBy ?? "—"}</div></div>
            <div><span className="text-xs text-muted-foreground">Payout Ref | 付款参考号</span><div className="text-sm mt-1">{batch.payoutReference ?? "—"}</div></div>
          </CardContent>
        </Card>

        {batch.status === "draft" && (
          <Card className="border-primary/20">
            <CardHeader><CardTitle className="text-sm">Mark Batch as Paid | 标记批次为已付款</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">This pays every commission in this batch at once with the same payout reference | 这会用同一个付款参考号一次性把批次内所有佣金标记为已付款</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Payout Reference | 付款参考号 *</Label>
                  <Input value={payoutReference} onChange={e => setPayoutReference(e.target.value)} placeholder="Bank transfer batch ref" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Audit Note | 审计备注</Label>
                  <Input value={auditNote} onChange={e => setAuditNote(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleMarkPaid} disabled={markPaid.isPending}>
                  {markPaid.isPending ? "Processing..." : "Mark Paid | 标记已付款"}
                </Button>
                <Button variant="outline" onClick={handleExport} disabled={!exportBatch.data}>Export CSV | 导出CSV</Button>
                <Button variant="destructive" onClick={handleCancel} disabled={cancelBatch.isPending}>Cancel Batch | 取消批次</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {batch.status !== "draft" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={!exportBatch.data}>Export CSV | 导出CSV</Button>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm">Commissions in this batch | 批次内的佣金</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {batch.commissions.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.partnerName}</span>
                      <CommissionStatusChip status={c.status} />
                      <CommissionTypeChip type={c.commissionType} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Lead: {c.leadName}</div>
                  </div>
                  <div className="font-medium flex-shrink-0">RM{Number(c.amount).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
