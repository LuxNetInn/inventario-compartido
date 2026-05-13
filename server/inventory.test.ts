import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB helpers
vi.mock("./db", () => ({
  getProducts: vi.fn().mockResolvedValue([
    {
      id: 1, name: "Test Product", category: "Electronics",
      costPrice: "10.00", salePrice: "25.00", stock: 50,
      lowStockThreshold: 5, supplier: "Supplier A",
      notes: null, currency: "USD", isActive: 1,
      createdAt: new Date(), updatedAt: new Date(), createdBy: 1,
    },
  ]),
  getProductById: vi.fn().mockResolvedValue({
    id: 1, name: "Test Product", costPrice: "10.00", salePrice: "25.00",
    stock: 50, lowStockThreshold: 5, currency: "USD", isActive: 1,
    createdAt: new Date(), updatedAt: new Date(),
  }),
  createProduct: vi.fn().mockResolvedValue({}),
  updateProduct: vi.fn().mockResolvedValue({}),
  deleteProduct: vi.fn().mockResolvedValue({}),
  addPriceHistory: vi.fn().mockResolvedValue({}),
  getPriceHistory: vi.fn().mockResolvedValue([]),
  getLowStockProducts: vi.fn().mockResolvedValue([]),
  createMovement: vi.fn().mockResolvedValue({}),
  getMovements: vi.fn().mockResolvedValue([]),
  getMovementsWithProducts: vi.fn().mockResolvedValue([]),
  getDashboardStats: vi.fn().mockResolvedValue({
    totalProducts: 1, totalInventoryValue: 500, totalSaleValue: 1250,
    estimatedProfit: 750, lowStockCount: 0, lowStockItems: [],
    monthlyRevenue: 250, monthlyShipping: 15,
  }),
  getSalesChartData: vi.fn().mockResolvedValue([]),
  getTopProducts: vi.fn().mockResolvedValue([]),
  getBalanceSummary: vi.fn().mockResolvedValue({
    totalRevenue: 250, totalCogs: 100, totalShipping: 15,
    grossProfit: 150, netProfit: 135,
  }),
  getSetting: vi.fn().mockResolvedValue("240"),
  setSetting: vi.fn().mockResolvedValue({}),
  getAllSettings: vi.fn().mockResolvedValue([
    { id: 1, key: "exchangeRate", value: "240", updatedAt: new Date() },
  ]),
  createInvitation: vi.fn().mockResolvedValue({}),
  getInvitationByToken: vi.fn().mockResolvedValue(null),
  markInvitationUsed: vi.fn().mockResolvedValue({}),
  getActiveInvitations: vi.fn().mockResolvedValue([]),
  getAllUsers: vi.fn().mockResolvedValue([]),
  upsertUser: vi.fn().mockResolvedValue({}),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

function makeCtx(role: "admin" | "user" = "user"): TrpcContext {
  return {
    user: {
      id: 1, openId: "test-user", name: "Test User",
      email: "test@example.com", loginMethod: "manus",
      role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("products router", () => {
  it("lists products", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.products.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("creates a product", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.products.create({
      name: "New Product", costPrice: "5.00", salePrice: "15.00",
      stock: 10, currency: "USD",
    });
    expect(result.success).toBe(true);
  });

  it("returns price history for a product", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.products.priceHistory({ productId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns low stock products", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.products.lowStock();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("movements router", () => {
  it("lists movements with products", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.movements.listWithProducts();
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a sale movement", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.movements.create({
      productId: 1, type: "sale", quantity: 2,
      unitPrice: "25.00", shippingCost: "5.00", currency: "USD",
    });
    expect(result.success).toBe(true);
  });

  it("creates a restock movement", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.movements.create({
      productId: 1, type: "restock", quantity: 10, currency: "USD",
    });
    expect(result.success).toBe(true);
  });
});

describe("dashboard router", () => {
  it("returns dashboard stats", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const stats = await caller.dashboard.stats();
    expect(stats).toBeTruthy();
    expect(stats?.totalProducts).toBe(1);
    expect(stats?.estimatedProfit).toBe(750);
  });

  it("returns balance summary", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const balance = await caller.dashboard.balance();
    expect(balance?.netProfit).toBe(135);
    expect(balance?.totalRevenue).toBe(250);
  });

  it("returns sales chart data", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const chart = await caller.dashboard.salesChart({});
    expect(Array.isArray(chart)).toBe(true);
  });
});

describe("settings router", () => {
  it("gets a setting", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const val = await caller.settings.get({ key: "exchangeRate" });
    expect(val).toBe("240");
  });

  it("sets a setting", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.settings.set({ key: "exchangeRate", value: "250" });
    expect(result.success).toBe(true);
  });

  it("gets all settings", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const all = await caller.settings.getAll();
    expect(Array.isArray(all)).toBe(true);
  });
});

describe("invitations router", () => {
  it("admin can create invitation", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.invitations.create({ origin: "https://example.com" });
    expect(result.token).toBeTruthy();
    expect(result.inviteUrl).toContain("/invite/");
  });

  it("non-admin cannot create invitation", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.invitations.create({ origin: "https://example.com" })).rejects.toThrow();
  });
});

describe("notifications router", () => {
  it("checkLowStock returns count and sent fields", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.notifications.checkLowStock();
    expect(result).toHaveProperty("count");
    expect(result).toHaveProperty("sent");
    expect(typeof result.count).toBe("number");
    expect(typeof result.sent).toBe("boolean");
  });

  it("returns message when no low stock items", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.notifications.checkLowStock();
    // Mock returns empty array for getLowStockProducts
    expect(result.sent).toBe(false);
    expect(result.count).toBe(0);
  });
});

describe("dashboard.balance with date filters", () => {
  it("accepts optional from/to date filters", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const from = new Date("2024-01-01");
    const to = new Date("2024-12-31");
    const result = await caller.dashboard.balance({ from, to });
    expect(result?.totalRevenue).toBe(250);
    expect(result?.netProfit).toBe(135);
  });

  it("accepts no date filters for all-time balance", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dashboard.balance();
    expect(result?.totalRevenue).toBe(250);
    expect(result?.grossProfit).toBe(150);
  });
});

describe("auth router", () => {
  it("logout clears session cookie", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});
