import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { dashboardForRole, hasRole } from "@/lib/roles";

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
    } else if (!isLoading && isAuthenticated && user && roles.length > 0 && !hasRole(user.role, roles)) {
      setLocation(dashboardForRole(user.role));
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
      setLocation(dashboardForRole(user?.role));
    } else if (!isLoading && !isAuthenticated && location === "/") {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, user, location, setLocation]);

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/ref/:code" component={ReferralLanding} />

      {/* Admin routes */}
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} roles={["super_admin", "brand_admin", "finance"]} />} />
      <Route path="/admin/campaigns" component={() => <ProtectedRoute component={CampaignsPage} roles={["super_admin", "brand_admin"]} />} />
      <Route path="/admin/partners" component={() => <ProtectedRoute component={PartnersPage} roles={["super_admin", "brand_admin"]} />} />
      <Route path="/admin/payouts" component={() => <ProtectedRoute component={PayoutsPage} roles={["super_admin", "finance"]} />} />
      <Route path="/admin/audit" component={() => <ProtectedRoute component={AuditPage} roles={["super_admin", "brand_admin", "outlet_staff", "finance"]} />} />
      <Route path="/admin/exports" component={() => <ProtectedRoute component={ExportsPage} roles={["super_admin", "brand_admin", "outlet_staff", "finance"]} />} />

      {/* Staff routes */}
      <Route path="/staff" component={() => <ProtectedRoute component={StaffDashboard} roles={["super_admin", "brand_admin", "outlet_staff"]} />} />
      <Route path="/staff/leads/:id" component={({ params }: any) => <ProtectedRoute component={LeadDetail} roles={["super_admin", "brand_admin", "outlet_staff"]} />} />
      <Route path="/staff/commissions" component={() => <ProtectedRoute component={StaffCommissions} roles={["super_admin", "brand_admin", "outlet_staff"]} />} />
      <Route path="/staff/audit" component={() => <ProtectedRoute component={StaffAudit} roles={["super_admin", "brand_admin", "outlet_staff"]} />} />

      {/* Partner routes */}
      <Route path="/partner" component={() => <ProtectedRoute component={PartnerDashboard} roles={["partner_admin", "partner_staff"]} />} />
      <Route path="/partner/leads" component={() => <ProtectedRoute component={PartnerLeads} roles={["partner_admin", "partner_staff"]} />} />
      <Route path="/partner/commissions" component={() => <ProtectedRoute component={PartnerCommissions} roles={["partner_admin", "partner_staff"]} />} />
      <Route path="/partner/statement" component={() => <ProtectedRoute component={PartnerStatement} roles={["partner_admin", "partner_staff"]} />} />

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
