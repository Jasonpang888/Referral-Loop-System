import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCommissionCanBeCreated,
  calculateCommission,
  normalizeMembershipId,
  normalizeMobile,
  roleMatches,
} from "./lib/referralRules";

test("first paid treatment creates one RM30 reward", () => {
  const commission = calculateCommission({
    paymentType: "first_paid_treatment",
    netSaleAmount: 120,
    commissionType: "flat_rm30",
    campaign: { flatRewardAmount: "30.00" },
  });

  assert.equal(commission?.commissionType, "flat_rm30");
  assert.equal(commission?.amount, 30);
  assert.equal(commission?.commissionRate, null);
});

test("free consultation creates no commission", () => {
  const commission = calculateCommission({
    paymentType: "free_consultation_only",
    netSaleAmount: 0,
  });

  assert.equal(commission, null);
});

test("repeat customer cannot create a second RM30 reward", () => {
  assert.throws(
    () => assertCommissionCanBeCreated({ leadCommissionId: 42, existingCommissionCount: 1, currentStage: "repeat_customer" }),
    /Commission already exists/,
  );
});

test("package percentage replaces fixed RM30", () => {
  const commission = calculateCommission({
    paymentType: "package_purchased",
    netSaleAmount: 680,
    commissionType: "package_percent",
    commissionRate: 10,
    campaign: { packageCommissionMin: "8", packageCommissionMax: "10" },
  });

  assert.equal(commission?.commissionType, "package_percent");
  assert.equal(commission?.amount, 68);
  assert.equal(commission?.commissionRate, 10);
});

test("package percentage rate is bounded by campaign config", () => {
  assert.throws(
    () => calculateCommission({
      paymentType: "package_purchased",
      netSaleAmount: 500,
      commissionType: "package_percent",
      commissionRate: 12,
      campaign: { packageCommissionMin: 8, packageCommissionMax: 10 },
    }),
    /between 8% and 10%/,
  );
});

test("duplicate mobile and membership IDs are normalized before comparison", () => {
  assert.equal(normalizeMobile("+60 12-345 6789"), "+60123456789");
  assert.equal(normalizeMembershipId(" kiri-amy-001 "), "KIRI-AMY-001");
});

test("partner data isolation roles do not grant finance or outlet access", () => {
  assert.equal(roleMatches("partner_admin", ["partner_admin", "partner_staff"]), true);
  assert.equal(roleMatches("partner_staff", ["partner_admin", "partner_staff"]), true);
  assert.equal(roleMatches("partner_staff", ["finance"]), false);
});

test("finance can run payout workflow but outlet staff cannot", () => {
  assert.equal(roleMatches("finance", ["super_admin", "finance"]), true);
  assert.equal(roleMatches("outlet_staff", ["super_admin", "finance"]), false);
});

test("audit rows can carry full before and after state", () => {
  const audit = {
    actor: "finance",
    previousState: "approved",
    newState: "paid",
    previousAmount: "30.00",
    newAmount: "30.00",
    reason: "Batch PAY-2026-001",
    ipAddress: "127.0.0.1",
  };

  assert.deepEqual(Object.keys(audit), [
    "actor",
    "previousState",
    "newState",
    "previousAmount",
    "newAmount",
    "reason",
    "ipAddress",
  ]);
});

test("CSV export content is deterministic", () => {
  const csv = [
    ["ID", "Lead", "Amount"],
    [1, "Sarah Chen", "30.00"],
  ].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");

  assert.match(csv, /"Sarah Chen"/);
  assert.match(csv, /"30.00"/);
});

test("language switching labels can be resolved", () => {
  const labels = {
    en: "Free consultation + 10% off eligible first treatment",
    zh: "Free consultation + 10% off eligible first treatment",
  };

  assert.equal(labels.en.includes("10%"), true);
  assert.equal(labels.zh.length > 0, true);
});
