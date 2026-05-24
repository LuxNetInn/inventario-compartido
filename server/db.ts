import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertInvitation,
  InsertMovement,
  InsertPriceHistory,
  InsertProduct,
  InsertSetting,
  InsertUser,
  InsertAppNotification,
  invitations,
  movements,
  priceHistory,
  products,
  settings,
  users,
  appNotifications,
  activityLog,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function updateUserPassword(openId: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ passwordHash }).where(eq(users.openId, openId));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(users).where(eq(users.id, id));
}

// ─── Products ─────────────────────────────────────────────────────────────────
export async function getProducts(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions = includeInactive ? [] : [eq(products.isActive, 1)];
  return db
    .select()
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(products.updatedAt));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(products).values(data);
  return result[0];
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(products).set({ isActive: 0 }).where(eq(products.id, id));
}

export async function getLowStockProducts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.isActive, 1),
        sql`${products.stock} <= ${products.lowStockThreshold}`
      )
    )
    .orderBy(products.stock);
}

// ─── Price History ────────────────────────────────────────────────────────────
export async function addPriceHistory(data: InsertPriceHistory) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(priceHistory).values(data);
}

export async function getPriceHistory(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.productId, productId))
    .orderBy(desc(priceHistory.changedAt));
}

// ─── Movements ────────────────────────────────────────────────────────────────
export async function createMovement(data: InsertMovement) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(movements).values(data);

  // Update stock
  const product = await getProductById(data.productId);
  if (product) {
    let newStock = product.stock;
    if (data.type === "sale") newStock -= data.quantity;
    else if (data.type === "restock") newStock += data.quantity;
    else if (data.type === "adjustment") newStock = data.quantity;
    await updateProduct(data.productId, { stock: Math.max(0, newStock) });
  }
  return result[0];
}

export async function getMovements(filters?: {
  productId?: number;
  type?: "sale" | "restock" | "adjustment";
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.productId) conditions.push(eq(movements.productId, filters.productId));
  if (filters?.type) conditions.push(eq(movements.type, filters.type));
  if (filters?.from) conditions.push(gte(movements.createdAt, filters.from));
  if (filters?.to) conditions.push(lte(movements.createdAt, filters.to));

  const query = db
    .select()
    .from(movements)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(movements.createdAt));

  if (filters?.limit) query.limit(filters.limit);
  return query;
}

export async function getMovementsWithProducts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: movements.id,
      type: movements.type,
      quantity: movements.quantity,
      unitPrice: movements.unitPrice,
      shippingCost: movements.shippingCost,
      currency: movements.currency,
      notes: movements.notes,
      createdAt: movements.createdAt,
      productId: movements.productId,
      productName: products.name,
      productCategory: products.category,
    })
    .from(movements)
    .leftJoin(products, eq(movements.productId, products.id))
    .orderBy(desc(movements.createdAt));
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return result[0]?.value ?? null;
}

export async function setSetting(key: string, value: string, updatedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .insert(settings)
    .values({ key, value, updatedBy })
    .onDuplicateKeyUpdate({ set: { value, updatedBy } });
}

export async function getAllSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(settings);
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;

  // Get exchange rate for CUP→USD normalisation (safe fallback to 240)
  const rateSetting = await getSetting("exchangeRate");
  const parsedRate = rateSetting ? parseFloat(rateSetting) : NaN;
  const exchangeRate = isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 240;
  const toUSD = (amount: number, currency: string) =>
    currency === "CUP" ? amount / exchangeRate : amount;

  const allProducts = await getProducts();
  const totalInventoryValue = allProducts.reduce(
    (sum, p) => sum + toUSD(parseFloat(p.costPrice as string), p.currency) * p.stock,
    0
  );
  const totalSaleValue = allProducts.reduce(
    (sum, p) => sum + toUSD(parseFloat(p.salePrice as string), p.currency) * p.stock,
    0
  );
  const totalProducts = allProducts.length;
  const lowStockItems = await getLowStockProducts();

  // Sales this month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const salesThisMonth = await getMovements({ type: "sale", from: firstOfMonth });

  const totalRevenue = salesThisMonth.reduce(
    (sum, m) => sum + toUSD((parseFloat(m.unitPrice as string) || 0) * m.quantity, m.currency),
    0
  );
  const totalShipping = salesThisMonth.reduce(
    (sum, m) => sum + toUSD(parseFloat(m.shippingCost as string || "0"), m.currency),
    0
  );

  return {
    totalProducts,
    totalInventoryValue,
    totalSaleValue,
    estimatedProfit: totalSaleValue - totalInventoryValue,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    monthlyRevenue: totalRevenue,
    monthlyShipping: totalShipping,
  };
}

export async function getSalesChartData(days = 30) {
  const db = await getDb();
  if (!db) return [];

  const rateSetting = await getSetting("exchangeRate");
  const parsedRate = rateSetting ? parseFloat(rateSetting) : NaN;
  const exchangeRate = isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 240;
  const toUSD = (amount: number, currency: string) =>
    currency === "CUP" ? amount / exchangeRate : amount;

  const from = new Date();
  from.setDate(from.getDate() - days);

  const sales = await getMovements({ type: "sale", from });
  const byDay: Record<string, { revenue: number; count: number }> = {};

  for (const s of sales) {
    const day = s.createdAt.toISOString().split("T")[0];
    if (!byDay[day]) byDay[day] = { revenue: 0, count: 0 };
    byDay[day].revenue += toUSD((parseFloat(s.unitPrice as string) || 0) * s.quantity, s.currency);
    byDay[day].count += s.quantity;
  }

  return Object.entries(byDay)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTopProducts(limit = 5) {
  const db = await getDb();
  if (!db) return [];

  const rateSetting = await getSetting("exchangeRate");
  const parsedRate = rateSetting ? parseFloat(rateSetting) : NaN;
  const exchangeRate = isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 240;
  const toUSD = (amount: number, currency: string) =>
    currency === "CUP" ? amount / exchangeRate : amount;

  const allMovements = await getMovementsWithProducts();
  const salesOnly = allMovements.filter((m) => m.type === "sale");

  const byProduct: Record<
    number,
    { productId: number; productName: string; totalQty: number; totalRevenue: number }
  > = {};

  for (const m of salesOnly) {
    if (!byProduct[m.productId]) {
      byProduct[m.productId] = {
        productId: m.productId,
        productName: m.productName || "Unknown",
        totalQty: 0,
        totalRevenue: 0,
      };
    }
    byProduct[m.productId].totalQty += m.quantity;
    byProduct[m.productId].totalRevenue +=
      toUSD((parseFloat(m.unitPrice as string) || 0) * m.quantity, m.currency);
  }

  return Object.values(byProduct)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

export async function getBalanceSummary(from?: Date, to?: Date) {
  const db = await getDb();
  if (!db) return null;

  // Normalise all monetary values to USD using the saved exchange rate (safe fallback)
  const rateSetting = await getSetting("exchangeRate");
  const parsedRate = rateSetting ? parseFloat(rateSetting) : NaN;
  const exchangeRate = isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 240;
  const toUSD = (amount: number, currency: string) =>
    currency === "CUP" ? amount / exchangeRate : amount;

  const allMovementsWithProducts = await getMovementsWithProducts();
  let totalRevenue = 0;
  let totalCogs = 0;
  let totalShipping = 0;

  // Filter by date if provided
  const salesMovements = allMovementsWithProducts.filter((m) => {
    if (m.type !== "sale") return false;
    if (from && m.createdAt < from) return false;
    if (to && m.createdAt > to) return false;
    return true;
  });
  for (const m of salesMovements) {
    totalRevenue += toUSD((parseFloat(m.unitPrice as string) || 0) * m.quantity, m.currency);
    totalShipping += toUSD(parseFloat(m.shippingCost as string || "0"), m.currency);
  }

  // Estimate COGS from product cost prices (normalised to USD)
  const allProducts = await getProducts();
  const productCostMap: Record<number, number> = {};
  for (const p of allProducts) {
    productCostMap[p.id] = toUSD(parseFloat(p.costPrice as string), p.currency);
  }
  for (const m of salesMovements) {
    totalCogs += (productCostMap[m.productId] || 0) * m.quantity;
  }

  return {
    totalRevenue,
    totalCogs,
    totalShipping,
    grossProfit: totalRevenue - totalCogs,
    netProfit: totalRevenue - totalCogs - totalShipping,
  };
}

// ─── Invitations ──────────────────────────────────────────────────────────────
export async function createInvitation(data: InsertInvitation) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(invitations).values(data);
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);
  return result[0];
}

export async function markInvitationUsed(token: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(invitations)
    .set({ usedBy: userId, usedAt: new Date() })
    .where(eq(invitations.token, token));
}

export async function getActiveInvitations(createdBy: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.createdBy, createdBy),
        sql`${invitations.expiresAt} > NOW()`,
        sql`${invitations.usedAt} IS NULL`
      )
    )
    .orderBy(desc(invitations.createdAt));
}

// ─── App Notifications ────────────────────────────────────────────────────────
export async function createAppNotification(data: InsertAppNotification) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(appNotifications).values(data);
}

export async function getNotificationsForUser(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(appNotifications)
    .where(eq(appNotifications.userId, userId))
    .orderBy(desc(appNotifications.createdAt))
    .limit(limit);
}

export async function getUnreadCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(appNotifications)
    .where(and(eq(appNotifications.userId, userId), eq(appNotifications.isRead, 0)));
  return Number(result[0]?.count ?? 0);
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(appNotifications)
    .set({ isRead: 1 })
    .where(and(eq(appNotifications.id, id), eq(appNotifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(appNotifications)
    .set({ isRead: 1 })
    .where(and(eq(appNotifications.userId, userId), eq(appNotifications.isRead, 0)));
}

// ─── Movement Delete / Update ─────────────────────────────────────────────────
export async function getMovementById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(movements).where(eq(movements.id, id)).limit(1);
  return result[0];
}

export async function deleteMovement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const movement = await getMovementById(id);
  if (!movement) throw new Error("Movimiento no encontrado");

  // Revert stock change
  const product = await getProductById(movement.productId);
  if (product) {
    let revertedStock = product.stock;
    if (movement.type === "sale") revertedStock += movement.quantity;
    else if (movement.type === "restock") revertedStock -= movement.quantity;
    // adjustment: can't reliably revert, leave stock as-is
    await updateProduct(movement.productId, { stock: Math.max(0, revertedStock) });
  }

  await db.delete(movements).where(eq(movements.id, id));
}

export async function updateMovement(id: number, data: Partial<{
  quantity: number;
  unitPrice: string;
  shippingCost: string;
  currency: "USD" | "CUP";
  notes: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await getMovementById(id);
  if (!existing) throw new Error("Movimiento no encontrado");

  // If quantity changed, adjust stock delta
  if (data.quantity !== undefined && data.quantity !== existing.quantity) {
    const product = await getProductById(existing.productId);
    if (product) {
      const oldQty = existing.quantity;
      const newQty = data.quantity;
      let newStock = product.stock;
      if (existing.type === "sale") {
        // Revert old sale, apply new sale
        newStock = newStock + oldQty - newQty;
      } else if (existing.type === "restock") {
        // Revert old restock, apply new restock
        newStock = newStock - oldQty + newQty;
      }
      await updateProduct(existing.productId, { stock: Math.max(0, newStock) });
    }
  }

  await db.update(movements).set(data).where(eq(movements.id, id));
}

// ─── Activity Log ─────────────────────────────────────────────────────────────
export async function logActivity(data: {
  userId?: number;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: number;
  details?: string;
}) {
  const db = await getDb();
  if (!db) return; // non-critical, fail silently
  try {
    await db.insert(activityLog).values(data);
  } catch {
    // activity log failures should never break the main flow
  }
}

export async function getActivityLog(limit = 50, filters?: {
  userId?: number;
  entityType?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.userId) conditions.push(eq(activityLog.userId, filters.userId));
  if (filters?.entityType) conditions.push(eq(activityLog.entityType, filters.entityType));

  return db
    .select()
    .from(activityLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
}
