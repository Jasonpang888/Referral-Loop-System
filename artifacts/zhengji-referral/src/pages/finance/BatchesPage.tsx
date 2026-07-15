import Layout from "@/components/Layout";
import {
  useGetPayoutBatches, useCreatePayoutBatch, getGetPayoutBatchesQueryKey,
  useGetCommissions, useGetPartners,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BatchStatusChip, CommissionTypeChip } from "@/components/StageChip";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function BatchesPage() {
  const [statusFilter, setStatusFilter] = useState("paid");
  const { data, isLoading } = useGetPayoutBatches({ status: statusFilter || undefined, limit: 50 });
  const { data: partners } = useGetPartners();
  const createBatch = useCreatePayoutBatch();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [showForm, setShowForm] = useState(false);
  const [partnerId, setPartnerId] = useState<string>("");
  const [bankReference, setBankReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [auditNote, setAuditNote] = useState("");
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: candidates, isLoading: candidatesLoading } = useGetCommissions(
    { status: "approved", partnerId: partnerId ? parseInt(partnerId, 10) : undefined, unbatched: true, limit: 100 },
    { query: { enabled: showForm && !!partnerId } }
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
    setPartnerId("");
    setBankReference("");
    setProofUrl("");
    setAuditNote("");
    setSaveAsDraft(false);
    setSelected(new Set());
    setShowForm(false);
  };

  const handleCreate = () => {
    if (!partnerId) {
      toast({ title: "Select a partner | 请选择合作伙伴", variant: "destructive" });
      return;
    }
    if (!bankReference) {
      toast({ title: "Enter the bank transfer reference | 请输入银行转账参考号", variant: "destructive" });
      return;
    }
    if (selected.size === 0) {
      toast({ title: "Select at least one commission | 请至少选择一条佣金记录", variant: "destructive" });
      return;
    }
    createBatch.mutate({
      data: {
        partnerId: parseInt(partnerId, 10),
        commissionIds: [...selected],
        bankReference,
        proofUrl: proofUrl || undefined,
        auditNote: auditNote || undefined,
        status: saveAsDraft ? "draft" : "paid",
      },
    }, {
      onSuccess: (batch) => {
        qc.invalidateQueries({ queryKey: getGetPayoutBatchesQueryKey() });
        toast({ title: `Batch #${batch.id} created | 批次 #${batch.id} 已创建` });
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
            <p className="text-sm text-muted-foreground mt-0.5">Log a partner payout — group approved commissions with the bank transfer reference | 记录给合作伙伴的付款，把已批准的佣金和银行转账参考号关联起来</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel | 取消" : "New Batch | 新建批次"}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">Log Payout Batch | 记录付款批次</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Partner | 合作伙伴 *</Label>
                  <Select value={partnerId} onValueChange={v => { setPartnerId(v); setSelected(new Set()); }}>
                    <SelectTrigger><SelectValue placeholder="Select partner | 选择合作伙伴" /></SelectTrigger>
                    <SelectContent>
                      {(partners ?? []).map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.displayName} ({p.referralCode})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bank Transfer Reference | 银行转账参考号 *</Label>
                  <Input value={bankReference} onChange={e => setBankReference(e.target.value)} placeholder="e.g. bank batch/transaction ref" />
                </div>
              </div>

              {partnerId && (
                <div className="space-y-2">
                  <Label className="text-xs">Approved commissions not yet batched | 已批准但未入批次的佣金</Label>
                  {candidatesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading... | 加载中...</p>
                  ) : (candidates?.commissions ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No approved commissions waiting for this partner | 该伙伴暂无待入批次的已批准佣金</p>
                  ) : (
                    <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                      {(candidates?.commissions ?? []).map(c => (
                        <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer text-sm">
                          <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelected(c.id)} />
                          <span className="flex-1 min-w-0">{c.leadName}</span>
                          <CommissionTypeChip type={c.commissionType} />
                          <span className="font-medium w-20 text-right">RM{Number(c.amount).toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Proof URL | 转账凭证链接</Label>
                <Input value={proofUrl} onChange={e => setProofUrl(e.target.value)} placeholder="https://... (screenshot/receipt of the transfer)" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Audit Note | 审计备注</Label>
                <Input value={auditNote} onChange={e => setAuditNote(e.target.value)} placeholder="Optional" />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox checked={saveAsDraft} onCheckedChange={(v) => setSaveAsDraft(!!v)} />
                Save as draft — haven't transferred the money yet | 存为草稿——还没实际转账
              </label>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">{selected.size} selected | 已选{selected.size}条 · Total | 总计: <strong className="text-foreground">RM{selectedTotal.toFixed(2)}</strong></span>
                <Button onClick={handleCreate} disabled={createBatch.isPending}>
                  {createBatch.isPending ? "Saving..." : saveAsDraft ? "Save Draft | 存为草稿" : "Log Payout | 记录付款"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 flex-wrap">
          {["draft", "paid", "disputed", "void"].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)}>
              {s === "draft" ? "Draft | 草稿" : s === "paid" ? "Paid | 已付款" : s === "disputed" ? "Disputed | 有争议" : "Void | 已作废"}
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
                      <span className="font-semibold">Batch #{b.id} · {b.partnerName}</span>
                      <BatchStatusChip status={b.status} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">{b.commissionIds.length} commissions | {b.commissionIds.length}条佣金 · Ref: {b.bankReference}</div>
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
