import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { roleMatches, getRoleHomePath } from "@/lib/roles";

import Login from "@/pages/Login";
import ReferralLanding from "@/pages/ref/ReferralLanding";

// Admin pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import CampaignsPage from "@/pages/admin/CampaignsPage";
import PartnersPage from "@/pages/admin/PartnersPage";
import PayoutsPage from "@/pages/admin/PayoutsPage";
import AuditPage from "@/pages/admin/AuditPage";
import ExportsPage from "@/pages/admin/ExportsPage";

// Staff pages
import StaffDashboard from "@/pages/staff/StaffDashboard";
import LeadDetail from "@/pages/staff/LeadDetail";
import StaffCommissions from "@/pages/staff/StaffCommissions";
import StaffAudit from "@/pages/staff/StaffAudit";

// Partner pages
import PartnerDashboard from "@/pages/partner/PartnerDashboard";
import PartnerLeads from "@/pages/partner/PartnerLeads";
import PartnerCommissions from "@/pages/partner/PartnerCommissions";
import PartnerStatement from "@/pages/partner/PartnerStatement";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoute({ component: Component, roles, ...rest }: { component: React.ComponentType<any>; roles: string[] }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    } else if (!isLoading && isAuthenticated && user && roles.length > 0 && !roleMatches(user.role, roles)) {
      const fallback = getRoleHomePath(user.role) ?? "/login";
      setLocation(fallback);
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  return isAuthenticated ? <Component {...rest} /> : null;
}

function RoleRouter() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated && location === "/") {
      const home = getRoleHomePath(user?.role);
      if (home) setLocation(home);
    } else if (!isLoading && !isAuthenticated && location === "/") {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, user, location, setLocation]);

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/ref/:code" component={ReferralLanding} />

      {/* Admin routes */}
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} roles={["admin"]} />} />
      <Route path="/admin/campaigns" component={() => <ProtectedRoute component={CampaignsPage} roles={["admin"]} />} />
      <Route path="/admin/partners" component={() => <ProtectedRoute component={PartnersPage} roles={["admin"]} />} />
      <Route path="/admin/payouts" component={() => <ProtectedRoute component={PayoutsPage} roles={["admin"]} />} />
      <Route path="/admin/audit" component={() => <ProtectedRoute component={AuditPage} roles={["admin"]} />} />
      <Route path="/admin/exports" component={() => <ProtectedRoute component={ExportsPage} roles={["admin"]} />} />

      {/* Staff routes */}
      <Route path="/staff" component={() => <ProtectedRoute component={StaffDashboard} roles={["admin", "zhengji_staff"]} />} />
      <Route path="/staff/leads/:id" component={({ params }: any) => <ProtectedRoute component={LeadDetail} roles={["admin", "zhengji_staff"]} />} />
      <Route path="/staff/commissions" component={() => <ProtectedRoute component={StaffCommissions} roles={["admin", "zhengji_staff"]} />} />
      <Route path="/staff/audit" component={() => <ProtectedRoute component={StaffAudit} roles={["admin", "zhengji_staff"]} />} />

      {/* Partner routes */}
      <Route path="/partner" component={() => <ProtectedRoute component={PartnerDashboard} roles={["kiri_partner"]} />} />
      <Route path="/partner/leads" component={() => <ProtectedRoute component={PartnerLeads} roles={["kiri_partner"]} />} />
      <Route path="/partner/commissions" component={() => <ProtectedRoute component={PartnerCommissions} roles={["kiri_partner"]} />} />
      <Route path="/partner/statement" component={() => <ProtectedRoute component={PartnerStatement} roles={["kiri_partner"]} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <RoleRouter />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
