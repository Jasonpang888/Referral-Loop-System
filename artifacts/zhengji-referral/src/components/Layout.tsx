import { ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLogout } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { roleMatches } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
  labelZh: string;
}

const adminNav: NavItem[] = [
  { href: "/admin", label: "Analytics", labelZh: "数据分析" },
  { href: "/admin/campaigns", label: "Campaigns", labelZh: "活动管理" },
  { href: "/admin/partners", label: "Partners", labelZh: "合作伙伴" },
  { href: "/admin/payouts", label: "Payouts", labelZh: "结算管理" },
  { href: "/admin/audit", label: "Audit Log", labelZh: "审计日志" },
  { href: "/admin/exports", label: "Exports", labelZh: "导出数据" },
];

const staffNav: NavItem[] = [
  { href: "/staff", label: "Lead Pipeline", labelZh: "客户管道" },
  { href: "/staff/commissions", label: "Commissions", labelZh: "佣金审批" },
  { href: "/staff/audit", label: "Audit Log", labelZh: "审计日志" },
];

const partnerNav: NavItem[] = [
  { href: "/partner", label: "Overview", labelZh: "总览" },
  { href: "/partner/leads", label: "My Leads", labelZh: "我的客户" },
  { href: "/partner/commissions", label: "Commissions", labelZh: "佣金记录" },
  { href: "/partner/statement", label: "Statement", labelZh: "月度报表" },
];

const financeNav: NavItem[] = [
  { href: "/finance", label: "Payout Batches", labelZh: "月结批次" },
];

// role is the raw DB value (e.g. super_admin, outlet_staff, finance, partner_admin,
// partner_staff) — must go through roleMatches/the alias table, not exact string
// equality, or every real account falls through to the empty-nav default below.
function getRoleNav(role?: string): NavItem[] {
  if (roleMatches(role, ["admin"])) return adminNav;
  if (roleMatches(role, ["finance"])) return financeNav;
  if (roleMatches(role, ["zhengji_staff"])) return staffNav;
  if (roleMatches(role, ["kiri_partner"])) return partnerNav;
  return [];
}

function getRoleLabel(role?: string) {
  if (roleMatches(role, ["admin"])) return { en: "Admin", zh: "管理员" };
  if (roleMatches(role, ["finance"])) return { en: "Finance", zh: "财务" };
  if (roleMatches(role, ["zhengji_staff"])) return { en: "Zhengji Staff", zh: "正脊堂员工" };
  if (roleMatches(role, ["kiri_partner"])) return { en: "Kiri Partner", zh: "Kiri合作伙伴" };
  return { en: "User", zh: "用户" };
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const logout = useLogout();

  const nav = getRoleNav(user?.role);
  const roleLabel = getRoleLabel(user?.role);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        localStorage.removeItem("zhengji_token");
        window.dispatchEvent(new Event("storage"));
      },
    });
  };

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-sidebar text-sidebar-foreground flex-shrink-0">
        <div className="p-5 border-b border-sidebar-border">
          <h1 className="text-lg font-serif font-bold leading-tight">正脊堂</h1>
          <p className="text-xs text-sidebar-foreground/70 mt-0.5 tracking-wider uppercase">Zhengji Wellness</p>
        </div>
        <div className="px-3 py-2 border-b border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider px-2 py-1">
            {roleLabel.en} | {roleLabel.zh}
          </p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const isActive = location === item.href || (item.href !== "/admin" && item.href !== "/staff" && item.href !== "/partner" && location.startsWith(item.href));
            const exactMatch = location === item.href;
            const isRoot = ["/admin", "/staff", "/partner"].includes(item.href);
            const active = isRoot ? exactMatch : isActive;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <span>{item.label}</span>
                <span className="text-xs opacity-70">{item.labelZh}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/60 mb-2">{user?.displayName}</div>
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs border-sidebar-border text-sidebar-foreground bg-transparent hover:bg-sidebar-accent"
            onClick={handleLogout}
          >
            Logout | 登出
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-serif font-bold">正脊堂</h1>
          <p className="text-xs text-sidebar-foreground/60">{roleLabel.en}</p>
        </div>
        <Button size="sm" variant="ghost" className="text-sidebar-foreground text-xs" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {/* Mobile nav tabs */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border flex overflow-x-auto">
        {nav.map((item) => {
          const exactMatch = location === item.href;
          const isRoot = ["/admin", "/staff", "/partner"].includes(item.href);
          const isActive = isRoot ? exactMatch : (location === item.href || location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 min-w-0 flex flex-col items-center py-2 px-1 text-center transition-colors",
                isActive ? "text-sidebar-primary-foreground bg-sidebar-primary" : "text-sidebar-foreground/70"
              )}
            >
              <span className="text-xs leading-tight truncate w-full text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto md:pb-0 pt-14 md:pt-0 pb-16">
        {children}
      </main>
    </div>
  );
}
