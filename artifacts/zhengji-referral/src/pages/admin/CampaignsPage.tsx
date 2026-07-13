import Layout from "@/components/Layout";
import { useGetCampaigns, useCreateCampaign, useUpdateCampaign, getGetCampaignsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function CampaignsPage() {
  const { data: campaigns, isLoading } = useGetCampaigns();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", nameZh: "", description: "", startDate: "", endDate: "",
    flatRewardAmount: 30, packageCommissionMin: 8, packageCommissionMax: 10,
    defaultCommissionType: "flat_rm30"
  });

  const resetForm = () => {
    setForm({ name: "", nameZh: "", description: "", startDate: "", endDate: "", flatRewardAmount: 30, packageCommissionMin: 8, packageCommissionMax: 10, defaultCommissionType: "flat_rm30" });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (c: any) => {
    setForm({
      name: c.name, nameZh: c.nameZh ?? "", description: c.description ?? "",
      startDate: c.startDate, endDate: c.endDate,
      flatRewardAmount: c.flatRewardAmount, packageCommissionMin: c.packageCommissionMin,
      packageCommissionMax: c.packageCommissionMax, defaultCommissionType: c.defaultCommissionType,
    });
    setEditing(c);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = { ...form };
    if (editing) {
      updateCampaign.mutate({ id: editing.id, data: payload as any }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCampaignsQueryKey() }); toast({ title: "Campaign updated | 活动已更新" }); resetForm(); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    } else {
      createCampaign.mutate({ data: payload as any }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCampaignsQueryKey() }); toast({ title: "Campaign created | 活动已创建" }); resetForm(); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    }
  };

  const handleToggleActive = (c: any) => {
    updateCampaign.mutate({ id: c.id, data: { isActive: !c.isActive } as any }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetCampaignsQueryKey() }),
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-primary">Campaigns | 活动管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Configure referral campaigns and commission rates | 配置推荐活动和佣金率</p>
          </div>
          <Button onClick={() => { setEditing(null); setShowForm(!showForm); }}>
            {showForm ? "Cancel | 取消" : "New Campaign | 新建活动"}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{editing ? "Edit Campaign | 编辑活动" : "Create Campaign | 创建活动"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Name (EN) | 名称（英文）</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Kiri Bar Campaign Q1" />
                </div>
                <div className="space-y-1">
                  <Label>Name (ZH) | 名称（中文）</Label>
                  <Input value={form.nameZh} onChange={e => setForm(f => ({ ...f, nameZh: e.target.value }))} placeholder="Kiri Bar Q1活动" />
                </div>
                <div className="space-y-1">
                  <Label>Start Date | 开始日期</Label>
                  <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>End Date | 结束日期</Label>
                  <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Flat Reward (RM) | 固定奖励（令吉）</Label>
                  <Input type="number" value={form.flatRewardAmount} onChange={e => setForm(f => ({ ...f, flatRewardAmount: parseFloat(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label>Default Commission Type | 默认佣金类型</Label>
                  <Select value={form.defaultCommissionType} onValueChange={v => setForm(f => ({ ...f, defaultCommissionType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat_rm30">Flat RM30 | 固定RM30</SelectItem>
                      <SelectItem value="package_percent">Package % | 套餐百分比</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Package Commission Min (%) | 套餐佣金下限 (%)</Label>
                  <Input type="number" min={0} max={100} value={form.packageCommissionMin} onChange={e => setForm(f => ({ ...f, packageCommissionMin: parseFloat(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label>Package Commission Max (%) | 套餐佣金上限 (%)</Label>
                  <Input type="number" min={0} max={100} value={form.packageCommissionMax} onChange={e => setForm(f => ({ ...f, packageCommissionMax: parseFloat(e.target.value) }))} />
                </div>
              </div>
              <Button onClick={handleSubmit} disabled={createCampaign.isPending || updateCampaign.isPending}>
                {editing ? "Save Changes | 保存更改" : "Create | 创建"}
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading... | 加载中...</p>
        ) : (
          <div className="space-y-3">
            {(campaigns ?? []).map((c) => (
              <Card key={c.id} className={c.isActive ? "" : "opacity-60"}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{c.name}</h3>
                        {c.nameZh && <span className="text-muted-foreground text-sm">| {c.nameZh}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                          {c.isActive ? "Active | 进行中" : "Inactive | 已停止"}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {c.startDate} → {c.endDate}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        <span className="text-foreground">Flat reward: <strong>RM{c.flatRewardAmount}</strong></span>
                        <span className="text-foreground">Pkg commission: <strong>{c.packageCommissionMin}%–{c.packageCommissionMax}%</strong></span>
                        <span className="text-foreground">Default: <strong>{c.defaultCommissionType === "flat_rm30" ? "Flat RM30" : "Package %"}</strong></span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(c)}>Edit | 编辑</Button>
                      <Button size="sm" variant="outline" onClick={() => handleToggleActive(c)}>
                        {c.isActive ? "Deactivate | 停用" : "Activate | 启用"}
                      </Button>
                    </div>
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
