import Layout from "@/components/Layout";
import { useGetPartnerStatement, useExportCommissions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StageChip, CommissionStatusChip } from "@/components/StageChip";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function downloadCSV(csvData: string, filename: string) {
  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function PartnerStatement() {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return d.toISOString().slice(0, 7);
  });
  const [selectedMonth, setSelectedMonth] = useState(months[0]);
  const { data, isLoading } = useGetPartnerStatement({ month: selectedMonth });
  const exportComms = useExportCommissions({});
  const { toast } = useToast();

  const handleDownload = () => {
    if (exportComms.data) {
      downloadCSV(exportComms.data.csvData, `statement_${selectedMonth}.csv`);
      toast({ title: "Statement downloaded | 报表已下载" });
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-serif font-bold text-primary">Monthly Statement | 月度报表</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Partner earnings statement | 合作伙伴收入报表</p>
          </div>
          <div className="flex gap-3 items-center">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!exportComms.data}>
              Download CSV | 下载CSV
            </Button>
          </div>
        </div>

        {isLoading && <p className="text-muted-foreground text-sm">Loading... | 加载中...</p>}

        {data && (
          <>
            {/* Header */}
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="py-4 px-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-primary-foreground/70 text-xs uppercase tracking-wider">Partner | 合作伙伴</p>
                    <p className="text-lg font-semibold mt-0.5">{data.partnerName}</p>
                    <p className="text-xs text-primary-foreground/70 mt-0.5 font-mono">{data.referralCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-primary-foreground/70 text-xs">Period | 期间</p>
                    <p className="font-semibold">{data.month}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Leads | 客户</p><p className="text-2xl font-bold">{data.summary.totalLeads}</p></CardContent></Card>
              <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Arrivals | 到访</p><p className="text-2xl font-bold">{data.summary.totalArrivals}</p></CardContent></Card>
              <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Conversions | 转化</p><p className="text-2xl font-bold">{data.summary.totalConversions}</p></CardContent></Card>
              <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Paid | 已付款</p><p className="text-2xl font-bold text-emerald-600">RM{data.summary.totalCommissionPaid.toFixed(2)}</p></CardContent></Card>
            </div>

            {/* Leads table */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Leads This Month | 本月客户</CardTitle></CardHeader>
              <CardContent className="p-0">
                {data.leads.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground text-sm">No leads this month | 本月暂无客户</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-muted-foreground text-xs"><th className="text-left py-2 px-4">Name | 姓名</th><th className="text-left py-2 px-4">Stage | 阶段</th><th className="text-left py-2 px-4">Date | 日期</th></tr></thead>
                    <tbody>
                      {data.leads.map(l => (
                        <tr key={l.id} className="border-b last:border-0">
                          <td className="py-2.5 px-4 font-medium">{l.name}</td>
                          <td className="py-2.5 px-4"><StageChip stage={l.stage} /></td>
                          <td className="py-2.5 px-4 text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString("zh-CN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Commissions table */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Commissions This Month | 本月佣金</CardTitle></CardHeader>
              <CardContent className="p-0">
                {data.commissions.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground text-sm">No commissions this month | 本月暂无佣金</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-muted-foreground text-xs"><th className="text-left py-2 px-4">Lead | 客户</th><th className="text-right py-2 px-4">Amount | 金额</th><th className="text-left py-2 px-4">Status | 状态</th><th className="text-left py-2 px-4">Payout Ref | 参考号</th></tr></thead>
                    <tbody>
                      {data.commissions.map(c => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2.5 px-4 font-medium">{c.leadName}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-primary">RM{Number(c.amount).toFixed(2)}</td>
                          <td className="py-2.5 px-4"><CommissionStatusChip status={c.status} /></td>
                          <td className="py-2.5 px-4 text-xs font-mono text-muted-foreground">{c.payoutReference ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
