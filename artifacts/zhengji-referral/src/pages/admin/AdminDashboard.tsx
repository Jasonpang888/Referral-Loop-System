import Layout from "@/components/Layout";
import { useGetAnalyticsSummary, useGetMonthlyTrend, useGetPipelineBreakdown } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const COLORS = ["#166534", "#4ade80", "#a16207", "#86efac", "#bbf7d0", "#dcfce7", "#94a3b8"];

function StatCard({ title, titleZh, value, sub }: { title: string; titleZh: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{title} | {titleZh}</p>
        <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: summary, isLoading: sumLoading } = useGetAnalyticsSummary();
  const { data: trend } = useGetMonthlyTrend({ months: 6 });
  const { data: pipeline } = useGetPipelineBreakdown();

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">Analytics | 数据分析</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Referral program performance overview | 推荐计划绩效概览</p>
        </div>

        {/* Summary Cards */}
        {sumLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Leads" titleZh="总客户" value={summary.totalLeads} />
            <StatCard title="Arrivals" titleZh="已到访" value={summary.totalArrivals} />
            <StatCard title="Conversions" titleZh="付费转化" value={summary.totalFirstPaidTreatment + summary.totalPackagePurchased} />
            <StatCard title="Conversion Rate" titleZh="转化率" value={`${summary.conversionRate?.toFixed(1)}%`} />
            <StatCard title="Referral Cost" titleZh="推荐成本" value={`RM${summary.totalReferralCost?.toFixed(2)}`} sub="Flat RM30 commissions | 固定佣金" />
            <StatCard title="Pkg Commission" titleZh="套餐佣金" value={`RM${summary.totalPackageCommission?.toFixed(2)}`} sub="% of net package | 套餐净值%" />
            <StatCard title="Avg Cost/Lead" titleZh="每客平均成本" value={`RM${summary.avgReferralCost?.toFixed(2)}`} />
            <StatCard title="Net Sales" titleZh="净销售额" value={`RM${summary.totalNetSales?.toFixed(2)}`} />
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          {trend && trend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Trend | 月度趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="leads" stroke="#166534" strokeWidth={2} name="Leads" />
                    <Line type="monotone" dataKey="arrivals" stroke="#4ade80" strokeWidth={2} name="Arrivals | 到访" />
                    <Line type="monotone" dataKey="conversions" stroke="#a16207" strokeWidth={2} name="Conversions | 转化" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Pipeline Breakdown */}
          {pipeline && pipeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pipeline Breakdown | 管道分布</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={pipeline} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="label" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#166534" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Monthly Commission Cost */}
        {trend && trend.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Commission Cost | 月度佣金成本</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => `RM${Number(v).toFixed(2)}`} />
                  <Bar dataKey="commissionCost" fill="#a16207" name="Commission Cost (RM)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top Partners */}
        {summary?.topPartners && summary.topPartners.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Partners | 优秀合作伙伴</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 px-2">Partner | 合作伙伴</th>
                      <th className="text-left py-2 px-2">Code | 推荐码</th>
                      <th className="text-right py-2 px-2">Leads | 客户</th>
                      <th className="text-right py-2 px-2">Conversions | 转化</th>
                      <th className="text-right py-2 px-2">Commission | 佣金</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topPartners.map((p) => (
                      <tr key={p.partnerId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 px-2 font-medium">{p.partnerName}</td>
                        <td className="py-2.5 px-2 font-mono text-xs text-primary">{p.referralCode}</td>
                        <td className="py-2.5 px-2 text-right">{p.totalLeads}</td>
                        <td className="py-2.5 px-2 text-right">{p.totalConversions}</td>
                        <td className="py-2.5 px-2 text-right font-medium">RM{p.totalCommission?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border">
          <strong>Business Rules | 业务规则:</strong> RM30 referral reward is triggered ONLY when a referred member completes their first paid treatment. No commission on repeat visits. Alternative: 8-10% of net package value (never both) | RM30奖励仅在被推荐客户完成首次付费治疗时触发，复诊不计佣金。替代方案：套餐净值的8-10%，二选一。
        </div>
      </div>
    </Layout>
  );
}
