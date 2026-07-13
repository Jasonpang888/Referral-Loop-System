import Layout from "@/components/Layout";
import { useGetLead, useUpdateLeadStage, useVerifyPayment, useGetLeadWhatsappMessage, getGetLeadsQueryKey, getGetLeadQueryKey, getGetLeadWhatsappMessageQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StageChip, CommissionTypeChip } from "@/components/StageChip";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const STAGES = [
  { value: "new_lead", label: "New Lead | 新客" },
  { value: "appointment_booked", label: "Appt Booked | 已预约" },
  { value: "arrived", label: "Arrived | 已到访" },
  { value: "free_consultation_only", label: "Free Consult | 仅免费咨询" },
  { value: "first_paid_treatment", label: "First Paid | 首次付费" },
  { value: "package_purchased", label: "Package Purchased | 购买套餐" },
  { value: "invalid_cancelled", label: "Invalid/Cancelled | 无效取消" },
];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const leadId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { data: lead, isLoading } = useGetLead(leadId);
  const { data: waMessages } = useGetLeadWhatsappMessage(leadId, { query: { queryKey: getGetLeadWhatsappMessageQueryKey(leadId), enabled: !!leadId } });
  const updateStage = useUpdateLeadStage();
  const verifyPayment = useVerifyPayment();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [paymentForm, setPaymentForm] = useState({
    netSaleAmount: "",
    paymentType: "first_paid_treatment",
    proofUrl: "",
    commissionType: "flat_rm30",
    commissionRate: "10",
    auditNote: "",
  });
  const [stageNote, setStageNote] = useState("");
  const [showWaEn, setShowWaEn] = useState(false);
  const [showWaZh, setShowWaZh] = useState(false);

  const handleStageChange = (stage: string) => {
    updateStage.mutate({ id: leadId, data: { stage, auditNote: stageNote || undefined } as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        qc.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        toast({ title: "Stage updated | 阶段已更新" });
        setStageNote("");
      },
      onError: () => toast({ title: "Error updating stage", variant: "destructive" }),
    });
  };

  const handleVerifyPayment = () => {
    if (!paymentForm.netSaleAmount) {
      toast({ title: "Enter net sale amount | 请输入净销售金额", variant: "destructive" });
      return;
    }
    verifyPayment.mutate({
      id: leadId,
      data: {
        netSaleAmount: parseFloat(paymentForm.netSaleAmount),
        paymentType: paymentForm.paymentType,
        proofUrl: paymentForm.proofUrl || null,
        commissionType: paymentForm.commissionType,
        commissionRate: paymentForm.commissionType === "package_percent" ? parseFloat(paymentForm.commissionRate) : null,
        auditNote: paymentForm.auditNote || null,
      } as any,
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        qc.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        toast({ title: "Payment verified & commission created | 付款已验证，佣金已创建" });
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Error verifying payment", variant: "destructive" }),
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard | 已复制到剪贴板" });
  };

  if (isLoading) return <Layout><div className="p-6 text-muted-foreground">Loading... | 加载中...</div></Layout>;
  if (!lead) return <Layout><div className="p-6 text-destructive">Lead not found | 未找到客户记录</div></Layout>;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => setLocation("/staff")}>← Back | 返回</Button>
          <div>
            <h1 className="text-xl font-serif font-bold text-primary">{lead.name}{lead.nameZh ? ` | ${lead.nameZh}` : ""}</h1>
            <p className="text-sm text-muted-foreground">Lead #{lead.id} · {lead.referralCode}</p>
          </div>
        </div>

        {/* Lead Info */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Customer Info | 客户信息</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground text-xs">Mobile | 手机</span><div className="font-medium">{lead.mobile}</div></div>
            <div><span className="text-muted-foreground text-xs">WhatsApp</span><div>{lead.whatsapp ?? "—"}</div></div>
            <div><span className="text-muted-foreground text-xs">Kiri ID | Kiri号</span><div className="font-mono">{lead.kirimembershipId ?? "—"}</div></div>
            <div><span className="text-muted-foreground text-xs">Partner | 推荐人</span><div>{lead.partnerName}</div></div>
            <div><span className="text-muted-foreground text-xs">Offer | 优惠</span><div>{lead.selectedOffer}</div></div>
            <div><span className="text-muted-foreground text-xs">Consent | 隐私同意</span><div>{lead.consentGiven ? "Yes | 是" : "No | 否"}</div></div>
            <div><span className="text-muted-foreground text-xs">Language | 语言</span><div>{lead.lang === "zh" ? "中文" : "English"}</div></div>
            <div><span className="text-muted-foreground text-xs">Created | 创建日期</span><div>{new Date(lead.createdAt).toLocaleDateString("zh-CN")}</div></div>
            {lead.appointmentIntent && <div className="col-span-2"><span className="text-muted-foreground text-xs">Appointment Intent | 预约意向</span><div>{lead.appointmentIntent}</div></div>}
            {lead.notes && <div className="col-span-2"><span className="text-muted-foreground text-xs">Notes | 备注</span><div>{lead.notes}</div></div>}
          </CardContent>
        </Card>

        {/* Current Stage */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Pipeline Stage | 管道阶段</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Current | 当前:</span>
              <StageChip stage={lead.stage} />
            </div>
            {lead.netSaleAmount != null && (
              <div className="text-sm"><span className="text-muted-foreground">Net Sale | 净销售额: </span><strong>RM{Number(lead.netSaleAmount).toFixed(2)}</strong></div>
            )}
            {lead.commissionId && (
              <div className="text-xs text-primary">Commission #{lead.commissionId} created | 佣金记录 #{lead.commissionId} 已创建</div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Move to Stage | 更改阶段</Label>
              <Select onValueChange={handleStageChange}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Select new stage | 选择新阶段" /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Audit note (optional) | 审计备注（可选）" value={stageNote} onChange={e => setStageNote(e.target.value)} className="text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Payment Verification */}
        {!lead.commissionId && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm">Verify Payment & Create Commission | 验证付款并创建佣金</CardTitle>
              <p className="text-xs text-muted-foreground">One-time only — RM30 OR % of package (never both) | 仅限一次——RM30固定奖励或套餐百分比，二选一</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Net Sale Amount (RM) | 净销售金额（令吉） *</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={paymentForm.netSaleAmount} onChange={e => setPaymentForm(f => ({ ...f, netSaleAmount: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Type | 付款类型 *</Label>
                  <Select value={paymentForm.paymentType} onValueChange={v => setPaymentForm(f => ({ ...f, paymentType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first_paid_treatment">First Paid Treatment | 首次付费治疗</SelectItem>
                      <SelectItem value="package_purchased">Package Purchased | 购买套餐</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Commission Type - mutually exclusive */}
              <div className="space-y-2">
                <Label className="text-xs">Commission Type | 佣金类型 (Choose ONE | 二选一)</Label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPaymentForm(f => ({ ...f, commissionType: "flat_rm30" }))}
                    className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${paymentForm.commissionType === "flat_rm30" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted/40"}`}
                  >
                    <div className="font-semibold">RM30 Flat</div>
                    <div className="text-xs mt-0.5">固定推荐奖励</div>
                  </button>
                  <button
                    onClick={() => setPaymentForm(f => ({ ...f, commissionType: "package_percent" }))}
                    className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${paymentForm.commissionType === "package_percent" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted/40"}`}
                  >
                    <div className="font-semibold">Package % Commission</div>
                    <div className="text-xs mt-0.5">套餐净值百分比</div>
                  </button>
                </div>
              </div>

              {paymentForm.commissionType === "package_percent" && (
                <div className="space-y-1">
                  <Label className="text-xs">Commission Rate (%) | 佣金率 (%) — Configurable 8–10% | 可配置8–10%</Label>
                  <Input type="number" min={8} max={10} step={0.5} value={paymentForm.commissionRate} onChange={e => setPaymentForm(f => ({ ...f, commissionRate: e.target.value }))} className="w-32" />
                  {paymentForm.netSaleAmount && (
                    <p className="text-xs text-primary">Commission = RM{(parseFloat(paymentForm.netSaleAmount || "0") * parseFloat(paymentForm.commissionRate || "0") / 100).toFixed(2)}</p>
                  )}
                </div>
              )}

              {paymentForm.commissionType === "flat_rm30" && paymentForm.netSaleAmount && (
                <p className="text-xs text-primary">Commission = RM30.00 (flat reward | 固定奖励)</p>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Proof URL | 付款凭证链接</Label>
                <Input placeholder="https://..." value={paymentForm.proofUrl} onChange={e => setPaymentForm(f => ({ ...f, proofUrl: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Audit Note | 审计备注</Label>
                <Textarea rows={2} placeholder="Optional note for audit trail | 可选审计备注" value={paymentForm.auditNote} onChange={e => setPaymentForm(f => ({ ...f, auditNote: e.target.value }))} />
              </div>
              <Button onClick={handleVerifyPayment} disabled={verifyPayment.isPending} className="w-full">
                {verifyPayment.isPending ? "Processing..." : "Verify Payment & Create Commission | 验证付款并创建佣金"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* WhatsApp Messages */}
        {waMessages && (
          <Card>
            <CardHeader><CardTitle className="text-sm">WhatsApp Message | WhatsApp确认消息</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">English</Label>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyToClipboard(waMessages.messageEn)}>Copy | 复制</Button>
                </div>
                <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap font-sans leading-relaxed">{waMessages.messageEn}</pre>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">中文</Label>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyToClipboard(waMessages.messageZh)}>Copy | 复制</Button>
                </div>
                <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap font-sans leading-relaxed">{waMessages.messageZh}</pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
