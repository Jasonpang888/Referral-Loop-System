import Layout from "@/components/Layout";
import { useGetPartnerStats, useGetPartnerLeads } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { StageChip } from "@/components/StageChip";
import { useState } from "react";

function StatCard({ title: titleEn, titleZh, value, className = "" }: { title: string; titleZh: string; value: string | number; className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{titleEn} | {titleZh}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function PartnerDashboard() {
  const { user } = useAuth();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: stats } = useGetPartnerStats({ month: currentMonth });
  const { data: leadsData } = useGetPartnerLeads({ page: 1 });

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">Partner Overview | 合作伙伴总览</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome, {user?.displayName} · {currentMonth}</p>
        </div>

        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs">
          <strong>Referral Link | 推荐链接:</strong>{" "}
          <span className="font-mono text-primary">
            {window.location.origin}/ref/{/* partner code shown via leads data */}
            {leadsData?.leads[0]?.referralCode ?? "YOUR_CODE"}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/ref/${leadsData?.leads[0]?.referralCode ?? ""}`)}
            className="ml-2 underline text-primary hover:text-primary/80"
          >
            Copy | 复制
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard title="Total Leads" titleZh="总客户" value={stats.totalLeads} />
            <StatCard title="Arrivals" titleZh="已到访" value={stats.totalArrivals} />
            <StatCard title="Conversions" titleZh="付费转化" value={stats.totalConversions} />
            <StatCard title="Pending Commission" titleZh="待处理佣金" value={`RM${stats.totalCommissionPending.toFixed(2)}`} />
            <StatCard title="Approved Commission" titleZh="已批准佣金" value={`RM${stats.totalCommissionApproved.toFixed(2)}`} />
            <StatCard title="Paid Commission" titleZh="已付款佣金" value={`RM${stats.totalCommissionPaid.toFixed(2)}`} />
          </div>
        )}

        {stats && (
          <Card>
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Conversion Rate | 转化率</p>
                  <p className="text-3xl font-bold text-primary mt-1">{stats.conversionRate.toFixed(1)}%</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div>{stats.totalConversions} paid / {stats.totalLeads} leads</div>
                  <div className="text-xs mt-1">付费转化 / 总客户</div>
                </div>
              </div>
              <div className="mt-3 bg-muted rounded-full h-2">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${Math.min(100, stats.conversionRate)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Business Rules */}
        <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border">
          <strong>How commissions work | 佣金说明:</strong>
          <ul className="mt-1 space-y-1 list-disc ml-4">
            <li>RM30 reward when your referred member completes their first paid treatment | 被推荐客户完成首次付费治疗时获得RM30奖励</li>
            <li>Alternative: 8-10% of net package value (configured by Zhengji) | 替代方案：套餐净值8-10%（由正记配置）</li>
            <li>One commission per referred customer — no repeat visit commissions | 每位推荐客户仅限一次佣金，复诊不计</li>
          </ul>
        </div>

        {/* Recent Leads */}
        {leadsData?.leads && leadsData.leads.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Recent Leads | 近期客户</h2>
            <div className="bg-card rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground text-xs">
                    <th className="text-left py-2.5 px-4">Name | 姓名</th>
                    <th className="text-left py-2.5 px-4">Stage | 阶段</th>
                    <th className="text-left py-2.5 px-4">Date | 日期</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsData.leads.slice(0, 5).map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2.5 px-4 font-medium">{l.name}</td>
                      <td className="py-2.5 px-4"><StageChip stage={l.stage} /></td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString("zh-CN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
