import Layout from "@/components/Layout";
import { useGetAuditLog } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function AuditPage() {
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetAuditLog({ entityType: entityType || undefined, page, limit: 30 });

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">Audit Log | 审计日志</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Immutable record of all actions | 所有操作的不可更改记录</p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Select value={entityType || "all"} onValueChange={v => { setEntityType(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by type | 按类型筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All | 全部</SelectItem>
              <SelectItem value="lead">Lead | 客户</SelectItem>
              <SelectItem value="commission">Commission | 佣金</SelectItem>
              <SelectItem value="partner">Partner | 合作伙伴</SelectItem>
              <SelectItem value="campaign">Campaign | 活动</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground text-xs">
                <th className="text-left py-3 px-4">Time | 时间</th>
                <th className="text-left py-3 px-4">Entity | 实体</th>
                <th className="text-left py-3 px-4">Action | 操作</th>
                <th className="text-left py-3 px-4">Change | 变更</th>
                <th className="text-left py-3 px-4">Performed By | 操作人</th>
                <th className="text-left py-3 px-4">Note | 备注</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Loading... | 加载中...</td></tr>
              )}
              {(data?.entries ?? []).map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">{new Date(e.createdAt).toLocaleString("zh-CN")}</td>
                  <td className="py-2.5 px-4">
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{e.entityType}#{e.entityId}</span>
                  </td>
                  <td className="py-2.5 px-4 font-medium text-xs">{e.action}</td>
                  <td className="py-2.5 px-4 text-xs">
                    {e.previousValue && <span className="text-muted-foreground line-through mr-1">{e.previousValue}</span>}
                    {e.newValue && <span className="text-foreground">{e.newValue}</span>}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground">{e.performedBy}</td>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground italic">{e.auditNote ?? "—"}</td>
                </tr>
              ))}
              {!isLoading && (data?.entries ?? []).length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No entries | 暂无记录</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 30 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{data.total} total entries | 共{data.total}条记录</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous | 上一页</Button>
              <Button size="sm" variant="outline" disabled={page * 30 >= data.total} onClick={() => setPage(p => p + 1)}>Next | 下一页</Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
