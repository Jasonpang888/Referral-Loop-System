import Layout from "@/components/Layout";
import { useExportLeads, useExportCommissions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function ExportsPage() {
  const { toast } = useToast();
  const [leadsFilters, setLeadsFilters] = useState({ stage: "", from: "", to: "" });
  const [commFilters, setCommFilters] = useState({ status: "", from: "", to: "" });

  const exportLeads = useExportLeads({ stage: leadsFilters.stage || undefined, from: leadsFilters.from || undefined, to: leadsFilters.to || undefined });
  const exportComms = useExportCommissions({ status: commFilters.status || undefined, from: commFilters.from || undefined, to: commFilters.to || undefined });

  const handleDownloadLeads = () => {
    if (exportLeads.data) {
      downloadCSV(exportLeads.data.csvData, exportLeads.data.filename);
      toast({ title: `Downloaded ${exportLeads.data.rowCount} leads | 已下载${exportLeads.data.rowCount}条客户记录` });
    }
  };

  const handleDownloadComms = () => {
    if (exportComms.data) {
      downloadCSV(exportComms.data.csvData, exportComms.data.filename);
      toast({ title: `Downloaded ${exportComms.data.rowCount} commissions | 已下载${exportComms.data.rowCount}条佣金记录` });
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">Exports | 数据导出</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Download CSV reports | 下载CSV报表</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Leads Export | 客户导出</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Stage | 阶段</Label>
                <Select value={leadsFilters.stage || "all"} onValueChange={v => setLeadsFilters(f => ({ ...f, stage: v === "all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stages | 全部阶段</SelectItem>
                    <SelectItem value="new_lead">New Lead | 新客</SelectItem>
                    <SelectItem value="appointment_booked">Appointment Booked | 已预约</SelectItem>
                    <SelectItem value="arrived">Arrived | 已到访</SelectItem>
                    <SelectItem value="first_paid_treatment">First Paid | 首次付费</SelectItem>
                    <SelectItem value="package_purchased">Package | 套餐</SelectItem>
                    <SelectItem value="invalid_cancelled">Invalid | 无效</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From | 从</Label>
                <Input type="date" className="h-8 text-xs" value={leadsFilters.from} onChange={e => setLeadsFilters(f => ({ ...f, from: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To | 至</Label>
                <Input type="date" className="h-8 text-xs" value={leadsFilters.to} onChange={e => setLeadsFilters(f => ({ ...f, to: e.target.value }))} />
              </div>
            </div>
            {exportLeads.data && <p className="text-xs text-muted-foreground">{exportLeads.data.rowCount} records ready | {exportLeads.data.rowCount}条记录已就绪</p>}
            <Button onClick={handleDownloadLeads} disabled={!exportLeads.data || exportLeads.isLoading}>
              Download Leads CSV | 下载客户CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Commissions Export | 佣金导出</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status | 状态</Label>
                <Select value={commFilters.status || "all"} onValueChange={v => setCommFilters(f => ({ ...f, status: v === "all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All | 全部</SelectItem>
                    <SelectItem value="pending">Pending | 待处理</SelectItem>
                    <SelectItem value="approved">Approved | 已批准</SelectItem>
                    <SelectItem value="paid">Paid | 已付款</SelectItem>
                    <SelectItem value="disputed">Disputed | 有争议</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From | 从</Label>
                <Input type="date" className="h-8 text-xs" value={commFilters.from} onChange={e => setCommFilters(f => ({ ...f, from: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To | 至</Label>
                <Input type="date" className="h-8 text-xs" value={commFilters.to} onChange={e => setCommFilters(f => ({ ...f, to: e.target.value }))} />
              </div>
            </div>
            {exportComms.data && <p className="text-xs text-muted-foreground">{exportComms.data.rowCount} records ready | {exportComms.data.rowCount}条记录已就绪</p>}
            <Button onClick={handleDownloadComms} disabled={!exportComms.data || exportComms.isLoading}>
              Download Commissions CSV | 下载佣金CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
