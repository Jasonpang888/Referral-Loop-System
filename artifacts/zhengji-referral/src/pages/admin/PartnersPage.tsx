import Layout from "@/components/Layout";
import { useGetPartners, useCreatePartner, getGetPartnersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function PartnersPage() {
  const { data: partners, isLoading } = useGetPartners();
  const createPartner = useCreatePartner();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ displayName: "", kirimembershipId: "", phone: "", username: "", password: "" });

  const handleSubmit = () => {
    if (!form.displayName || !form.kirimembershipId || !form.username || !form.password) {
      toast({ title: "Please fill all required fields | 请填写所有必填字段", variant: "destructive" });
      return;
    }
    createPartner.mutate({ data: form as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPartnersQueryKey() });
        toast({ title: "Partner created | 合作伙伴已创建" });
        setForm({ displayName: "", kirimembershipId: "", phone: "", username: "", password: "" });
        setShowForm(false);
      },
      onError: () => toast({ title: "Error creating partner", variant: "destructive" }),
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-primary">Partners | 合作伙伴</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage Kiri Bar partner accounts | 管理Kiri Bar合作伙伴账户</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel | 取消" : "Add Partner | 添加合作伙伴"}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">Create Partner Account | 创建合作伙伴账户</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Display Name | 显示名称 <span className="text-destructive">*</span></Label>
                  <Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Kiri Member Name" />
                </div>
                <div className="space-y-1">
                  <Label>Kiri Membership ID | Kiri会员号 <span className="text-destructive">*</span></Label>
                  <Input value={form.kirimembershipId} onChange={e => setForm(f => ({ ...f, kirimembershipId: e.target.value }))} placeholder="KIRI-001" />
                </div>
                <div className="space-y-1">
                  <Label>Phone | 电话</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+60123456789" />
                </div>
                <div className="space-y-1">
                  <Label>Username | 用户名 <span className="text-destructive">*</span></Label>
                  <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="kiri_partner1" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Password | 密码 <span className="text-destructive">*</span></Label>
                  <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
                </div>
              </div>
              <Button onClick={handleSubmit} disabled={createPartner.isPending}>
                {createPartner.isPending ? "Creating..." : "Create Account | 创建账户"}
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading... | 加载中...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-card rounded-xl overflow-hidden border">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground text-xs">
                  <th className="text-left py-3 px-4">Partner | 合作伙伴</th>
                  <th className="text-left py-3 px-4">Kiri ID | Kiri号</th>
                  <th className="text-left py-3 px-4">Referral Code | 推荐码</th>
                  <th className="text-right py-3 px-4">Leads | 客户</th>
                  <th className="text-right py-3 px-4">Conversions | 转化</th>
                  <th className="text-right py-3 px-4">Commission Earned | 佣金收入</th>
                  <th className="text-center py-3 px-4">Status | 状态</th>
                </tr>
              </thead>
              <tbody>
                {(partners ?? []).map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-medium">{p.displayName}</td>
                    <td className="py-3 px-4 text-muted-foreground">{p.kirimembershipId}</td>
                    <td className="py-3 px-4 font-mono text-primary text-xs">{p.referralCode}</td>
                    <td className="py-3 px-4 text-right">{p.totalLeads}</td>
                    <td className="py-3 px-4 text-right">{p.totalConversions}</td>
                    <td className="py-3 px-4 text-right font-medium">RM{Number(p.totalCommissionEarned).toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                        {p.isActive ? "Active | 活跃" : "Inactive | 停用"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
