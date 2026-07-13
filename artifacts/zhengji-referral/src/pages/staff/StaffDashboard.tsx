import Layout from "@/components/Layout";
import { useGetLeads, useUpdateLeadStage, getGetLeadsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StageChip } from "@/components/StageChip";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const STAGES = [
  { value: "new_lead", label: "New Lead | 新客" },
  { value: "appointment_booked", label: "Appt Booked | 已预约" },
  { value: "arrived", label: "Arrived | 已到访" },
  { value: "free_consultation_only", label: "Free Consult | 仅免费咨询" },
  { value: "first_paid_treatment", label: "First Paid | 首次付费" },
  { value: "package_purchased", label: "Package | 套餐" },
  { value: "invalid_cancelled", label: "Invalid | 无效" },
];

export default function StaffDashboard() {
  const [stageFilter, setStageFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetLeads({ stage: stageFilter || undefined, search: search || undefined, page, limit: 20 });
  const updateStage = useUpdateLeadStage();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleStageChange = (leadId: number, stage: string) => {
    updateStage.mutate({ id: leadId, data: { stage, auditNote: "Updated by staff" } as any }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetLeadsQueryKey() }); toast({ title: "Stage updated | 阶段已更新" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">Lead Pipeline | 客户管道</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all referred leads through the pipeline | 管理所有推荐客户的跟进流程</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search name/mobile/code | 搜索名字/手机/推荐码"
            className="max-w-xs"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <Select value={stageFilter || "all"} onValueChange={v => { setStageFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All stages | 全部阶段" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages | 全部阶段</SelectItem>
              {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Pipeline summary chips */}
        <div className="flex flex-wrap gap-2">
          {STAGES.map(s => {
            const cnt = data?.leads.filter(l => l.stage === s.value).length ?? 0;
            return stageFilter === s.value ? null : (
              <button key={s.value} onClick={() => { setStageFilter(s.value); setPage(1); }} className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
                {s.label.split(" | ")[0]}: <strong>{cnt}</strong>
              </button>
            );
          })}
        </div>

        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground text-xs">
                <th className="text-left py-3 px-4">Customer | 客户</th>
                <th className="text-left py-3 px-4">Contact | 联系方式</th>
                <th className="text-left py-3 px-4">Partner | 推荐人</th>
                <th className="text-left py-3 px-4">Stage | 阶段</th>
                <th className="text-left py-3 px-4">Update Stage | 更改阶段</th>
                <th className="text-left py-3 px-4">Net Sale | 净销售</th>
                <th className="text-left py-3 px-4">Date | 日期</th>
                <th className="text-left py-3 px-4">Actions | 操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Loading... | 加载中...</td></tr>}
              {(data?.leads ?? []).map((lead) => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium">{lead.name}</div>
                    {lead.nameZh && <div className="text-xs text-muted-foreground">{lead.nameZh}</div>}
                    {lead.kirimembershipId && <div className="text-xs text-muted-foreground font-mono">{lead.kirimembershipId}</div>}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div>{lead.mobile}</div>
                    {lead.whatsapp && lead.whatsapp !== lead.mobile && <div className="text-muted-foreground">WA: {lead.whatsapp}</div>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs">{lead.partnerName}</div>
                    <div className="text-xs font-mono text-primary">{lead.referralCode}</div>
                  </td>
                  <td className="py-3 px-4"><StageChip stage={lead.stage} /></td>
                  <td className="py-3 px-4">
                    <Select value={lead.stage} onValueChange={v => handleStageChange(lead.id, v)}>
                      <SelectTrigger className="w-40 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium">
                    {lead.netSaleAmount != null ? `RM${Number(lead.netSaleAmount).toFixed(2)}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="py-3 px-4">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setLocation(`/staff/leads/${lead.id}`)}>
                      Details | 详情
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && (data?.leads ?? []).length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No leads found | 未找到客户记录</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 20 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total: {data.total} leads | 共{data.total}条记录</span>
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
