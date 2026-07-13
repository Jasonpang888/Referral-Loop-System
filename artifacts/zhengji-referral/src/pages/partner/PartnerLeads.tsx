import Layout from "@/components/Layout";
import { useGetPartnerLeads } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StageChip } from "@/components/StageChip";
import { useState } from "react";

export default function PartnerLeads() {
  const [stageFilter, setStageFilter] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetPartnerLeads({ stage: stageFilter || undefined, page });

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">My Leads | 我的客户</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All leads referred through your link | 通过您的链接推荐的所有客户</p>
        </div>

        <Select value={stageFilter || "all"} onValueChange={v => { setStageFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All stages | 全部阶段" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages | 全部阶段</SelectItem>
            <SelectItem value="new_lead">New Lead | 新客</SelectItem>
            <SelectItem value="appointment_booked">Appt Booked | 已预约</SelectItem>
            <SelectItem value="arrived">Arrived | 已到访</SelectItem>
            <SelectItem value="free_consultation_only">Free Consult | 仅免费咨询</SelectItem>
            <SelectItem value="first_paid_treatment">First Paid | 首次付费</SelectItem>
            <SelectItem value="package_purchased">Package | 套餐</SelectItem>
            <SelectItem value="invalid_cancelled">Invalid | 无效</SelectItem>
          </SelectContent>
        </Select>

        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground text-xs">
                <th className="text-left py-3 px-4">Customer | 客户</th>
                <th className="text-left py-3 px-4">Contact | 联系方式</th>
                <th className="text-left py-3 px-4">Stage | 阶段</th>
                <th className="text-left py-3 px-4">Offer | 优惠</th>
                <th className="text-left py-3 px-4">Date | 日期</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading... | 加载中...</td></tr>}
              {(data?.leads ?? []).map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="py-3 px-4">
                    <div className="font-medium">{l.name}</div>
                    {l.kirimembershipId && <div className="text-xs text-muted-foreground font-mono">{l.kirimembershipId}</div>}
                  </td>
                  <td className="py-3 px-4 text-xs">{l.mobile}</td>
                  <td className="py-3 px-4"><StageChip stage={l.stage} /></td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{l.selectedOffer}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString("zh-CN")}</td>
                </tr>
              ))}
              {!isLoading && (data?.leads ?? []).length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No leads yet | 暂无客户记录</td></tr>
              )}
            </tbody>
          </table>
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
