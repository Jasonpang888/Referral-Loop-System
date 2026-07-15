import Layout from "@/components/Layout";
import {
  useGetPayoutBatch, useUpdatePayoutBatch, useExportPayoutBatch,
  getGetPayoutBatchQueryKey, getGetPayoutBatchesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BatchStatusChip, CommissionStatusChip, CommissionTypeChip } from "@/components/StageChip";
import { useParams, useLocation } from "wouter";
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
  const updateBatch = useUpdatePayoutBatch();
  const exportBatch = useExportPayoutBatch(batchId);
  const qc = useQueryClient();
  const { toast } = useToast();

  const transition = (status: string, label: string) => {
    updateBatch.mutate({ id: batchId, data: { status: status as any } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPayoutBatchQueryKey(batchId) });
        qc.invalidateQueries({ queryKey: getGetPayoutBatchesQueryKey() });
        toast({ title: label });
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Error updating batch", variant: "destructive" }),
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
            <h1 className="text-xl font-serif font-bold text-primary">Batch #{batch.id} · {batch.partnerName}</h1>
            <p className="text-sm text-muted-foreground">Bank Ref: {batch.bankReference}</p>
          </div>
          <BatchStatusChip status={batch.status} />
        </div>

        <Card>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5">
            <div><span className="text-xs text-muted-foreground">Total | 总额</span><div className="text-xl font-bold">RM{batch.totalAmount.toFixed(2)}</div></div>
            <div><span className="text-xs text-muted-foreground">Commissions | 佣金数</span><div className="text-xl font-bold">{batch.commissionIds.length}</div></div>
            <div><span className="text-xs text-muted-foreground">Created By | 创建人</span><div className="text-sm mt-1">{batch.createdBy}</div></div>
            <div><span className="text-xs text-muted-foreground">Paid At | 付款日期</span><div className="text-sm mt-1">{batch.paidAt ? new Date(batch.paidAt).toLocaleDateString("zh-CN") : "—"}</div></div>
            {batch.proofUrl && (
              <div className="col-span-2 md:col-span-4">
                <a href={batch.proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">View transfer proof | 查看转账凭证</a>
              </div>
            )}
            {batch.auditNote && (
              <div className="col-span-2 md:col-span-4 text-xs text-muted-foreground italic">Note: {batch.auditNote}</div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2 flex-wrap">
          {batch.status === "draft" && (
            <>
              <Button onClick={() => transition("paid", "Batch marked as paid | 批次已标记为已付款")} disabled={updateBatch.isPending}>
                Mark Transferred / Paid | 标记已转账
              </Button>
              <Button variant="destructive" onClick={() => transition("void", "Batch voided | 批次已作废")} disabled={updateBatch.isPending}>
                Void Draft | 作废草稿
              </Button>
            </>
          )}
          {batch.status === "paid" && (
            <Button variant="outline" onClick={() => transition("disputed", "Batch flagged as disputed | 批次已标记为有争议")} disabled={updateBatch.isPending}>
              Flag as Disputed | 标记为有争议
            </Button>
          )}
          {batch.status === "disputed" && (
            <Button onClick={() => transition("paid", "Dispute resolved — batch is paid | 争议已解决，批次已付款")} disabled={updateBatch.isPending}>
              Resolve — Mark Paid | 解决争议——标记已付款
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} disabled={!exportBatch.data}>Export CSV | 导出CSV</Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Commissions in this batch | 批次内的佣金</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {batch.commissions.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.leadName}</span>
                      <CommissionStatusChip status={c.status} />
                      <CommissionTypeChip type={c.commissionType} />
                    </div>
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
