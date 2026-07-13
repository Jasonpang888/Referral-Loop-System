type LoginResult = {
  user: {
    id: number;
    username: string;
    role: string;
    displayName: string;
    brandId?: number | null;
    partnerId?: number | null;
  };
  token: string;
};

const API_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8080/api").replace(/\/+$/, "");
const runId = process.env.SMOKE_RUN_ID ?? Date.now().toString();

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(data)}`);
  }
  return data as T;
}

async function expectStatus(path: string, expectedStatus: number, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(`${options.method ?? "GET"} ${path} expected ${expectedStatus}, got ${response.status}: ${body}`);
  }
}

async function login(username: string, password: string) {
  return request<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

function auth(token: string): Pick<RequestInit, "headers"> {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function main() {
  const superAdmin = await login("admin", "admin123");
  const brandAdmin = await login("brand_admin", "brand123");
  const staff = await login("staff", "staff123");
  const finance = await login("finance", "finance123");
  const partner = await login("kiri_amy", "partner123");

  if (brandAdmin.user.brandId == null || staff.user.brandId == null || finance.user.brandId == null || partner.user.brandId == null) {
    throw new Error("Expected brand-scoped users to have brandId after launch preparation");
  }

  await request("/analytics/summary", auth(superAdmin.token));
  await request("/analytics/summary", auth(brandAdmin.token));
  await expectStatus("/leads", 403, auth(finance.token));

  const referral = await request<{ campaignActive: boolean; referralCode: string }>("/referral/KIRIAMY001");
  if (!referral.campaignActive || referral.referralCode !== "KIRIAMY001") {
    throw new Error("Referral page is not active for KIRIAMY001");
  }

  const mobile = `+60197${runId.slice(-7).padStart(7, "0")}`;
  const membershipId = `KIRI-SMOKE-${runId}`;
  const lead = await request<{ id: number; commissionId?: number | null }>("/leads", {
    method: "POST",
    body: JSON.stringify({
      name: `Smoke Test ${runId}`,
      mobile,
      whatsapp: mobile,
      kirimembershipId: membershipId,
      referralCode: "KIRIAMY001",
      consentGiven: true,
      selectedOffer: "Free Consultation + 10% Discount",
      appointmentIntent: "Tomorrow afternoon",
      lang: "en",
    }),
  });

  await expectStatus("/leads", 409, {
    method: "POST",
    body: JSON.stringify({
      name: `Smoke Duplicate ${runId}`,
      mobile,
      kirimembershipId: membershipId,
      referralCode: "KIRIAMY001",
      consentGiven: true,
    }),
  });

  for (const stage of ["contacted", "appointment_booked", "arrived"]) {
    await request(`/leads/${lead.id}/stage`, {
      method: "PATCH",
      ...auth(staff.token),
      body: JSON.stringify({ stage, auditNote: `Smoke ${stage}` }),
    });
  }

  const verified = await request<{ id: number; commissionId?: number | null }>(`/leads/${lead.id}/verify-payment`, {
    method: "POST",
    ...auth(staff.token),
    body: JSON.stringify({
      paymentType: "first_paid_treatment",
      netSaleAmount: 128,
      auditNote: "Smoke first paid treatment",
    }),
  });

  if (!verified.commissionId) {
    throw new Error("Payment verification did not create a commission");
  }

  await expectStatus(`/leads/${lead.id}/verify-payment`, 409, {
    method: "POST",
    ...auth(staff.token),
    body: JSON.stringify({
      paymentType: "first_paid_treatment",
      netSaleAmount: 128,
      auditNote: "Smoke duplicate commission check",
    }),
  });

  await request(`/commissions/${verified.commissionId}/approve`, {
    method: "PATCH",
    ...auth(staff.token),
    body: JSON.stringify({ auditNote: "Smoke approved" }),
  });

  await request("/payout-batches", {
    method: "POST",
    ...auth(finance.token),
    body: JSON.stringify({
      commissionIds: [verified.commissionId],
      bankReference: `SMOKE-${runId}`,
      auditNote: "Smoke batch payout",
    }),
  });

  const partnerCommissions = await request<{ commissions: Array<{ id: number; status: string; payoutReference?: string | null }> }>("/partner/commissions?status=paid", auth(partner.token));
  const paidCommission = partnerCommissions.commissions.find((commission) => commission.id === verified.commissionId);
  if (!paidCommission || paidCommission.payoutReference !== `SMOKE-${runId}`) {
    throw new Error("Partner portal did not show the paid smoke commission");
  }

  console.log(`Kiri x Zhengji smoke passed. lead=${lead.id} commission=${verified.commissionId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
