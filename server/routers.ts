import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  addPriceHistory,
  createInvitation,
  createMovement,
  createProduct,
  deleteProduct,
  getActiveInvitations,
  getAllSettings,
  getAllUsers,
  getBalanceSummary,
  getDashboardStats,
  getInvitationByToken,
  getLowStockProducts,
  getMovements,
  getMovementsWithProducts,
  getPriceHistory,
  getProductById,
  getProducts,
  getSalesChartData,
  getSetting,
  getTopProducts,
  markInvitationUsed,
  setSetting,
  updateProduct,
  createAppNotification,
  getNotificationsForUser,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteMovement,
  updateMovement,
  logActivity,
  getActivityLog,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { shipmentsRouter } from "./routers/shipments";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

// ─── Products Router ──────────────────────────────────────────────────────────
const productsRouter = router({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }).optional())
    .query(({ input }) => getProducts(input?.includeInactive)),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getProductById(input.id)),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        category: z.string().optional(),
        costPrice: z.string(),
        salePrice: z.string(),
        stock: z.number().int().min(0),
        lowStockThreshold: z.number().int().min(0).optional(),
        supplier: z.string().optional(),
        notes: z.string().optional(),
        currency: z.enum(["USD", "CUP"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await createProduct({
        ...input,
        lowStockThreshold: input.lowStockThreshold ?? 5,
        currency: input.currency ?? "USD",
        createdBy: ctx.user.id,
      });
      await logActivity({
        userId: ctx.user.id,
        userName: ctx.user.name ?? undefined,
        action: "Creó producto",
        entityType: "product",
        details: `"${input.name}" — ${input.currency ?? "USD"} ${input.costPrice}/${input.salePrice}`,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        category: z.string().optional(),
        costPrice: z.string().optional(),
        salePrice: z.string().optional(),
        stock: z.number().int().min(0).optional(),
        lowStockThreshold: z.number().int().min(0).optional(),
        supplier: z.string().optional(),
        notes: z.string().optional(),
        currency: z.enum(["USD", "CUP"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, costPrice, salePrice, ...rest } = input;
      const existing = await getProductById(id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      // Track price changes
      if (costPrice !== undefined && costPrice !== existing.costPrice) {
        await addPriceHistory({
          productId: id,
          priceType: "cost",
          oldPrice: existing.costPrice as string,
          newPrice: costPrice,
          changedBy: ctx.user.id,
        });
      }
      if (salePrice !== undefined && salePrice !== existing.salePrice) {
        await addPriceHistory({
          productId: id,
          priceType: "sale",
          oldPrice: existing.salePrice as string,
          newPrice: salePrice,
          changedBy: ctx.user.id,
        });
      }

      await updateProduct(id, { ...rest, costPrice, salePrice });
      await logActivity({
        userId: ctx.user.id,
        userName: ctx.user.name ?? undefined,
        action: "Editó producto",
        entityType: "product",
        entityId: id,
        details: `"${existing.name}" actualizado`,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const prod = await getProductById(input.id);
      await deleteProduct(input.id);
      await logActivity({
        userId: ctx.user.id,
        userName: ctx.user.name ?? undefined,
        action: "Eliminó producto",
        entityType: "product",
        entityId: input.id,
        details: prod ? `"${prod.name}" eliminado` : `Producto #${input.id} eliminado`,
      });
      return { success: true };
    }),

  priceHistory: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(({ input }) => getPriceHistory(input.productId)),

  lowStock: protectedProcedure.query(() => getLowStockProducts()),
});

// ─── Movements Router ─────────────────────────────────────────────────────────
const movementsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          productId: z.number().optional(),
          type: z.enum(["sale", "restock", "adjustment"]).optional(),
          from: z.date().optional(),
          to: z.date().optional(),
          limit: z.number().optional(),
        })
        .optional()
    )
    .query(({ input }) => getMovements(input ?? undefined)),

  listWithProducts: protectedProcedure.query(() => getMovementsWithProducts()),

  create: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        type: z.enum(["sale", "restock", "adjustment"]),
        quantity: z.number().int().min(1),
        unitPrice: z.string().optional(),
        shippingCost: z.string().optional(),
        currency: z.enum(["USD", "CUP"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await createMovement({
        ...input,
        currency: input.currency ?? "USD",
        createdBy: ctx.user.id,
      });

      const typeLabel = input.type === "sale" ? "Venta" : input.type === "restock" ? "Restock" : "Ajuste";
      const product = await getProductById(input.productId);
      await logActivity({
        userId: ctx.user.id,
        userName: ctx.user.name ?? undefined,
        action: `Registró ${typeLabel.toLowerCase()}`,
        entityType: "movement",
        details: `${typeLabel} de ${input.quantity} uds de "${product?.name ?? input.productId}"${
          input.unitPrice ? ` a ${input.unitPrice} ${input.currency ?? "USD"}` : ""
        }`,
      });

      // Auto-notify on low stock after sale/adjustment
      if (input.type === "sale" || input.type === "adjustment") {
        if (product && product.stock <= product.lowStockThreshold) {
          notifyOwner({
            title: `⚠️ Stock bajo: ${product.name}`,
            content: `El producto "${product.name}" tiene ${product.stock} unidad${product.stock !== 1 ? "es" : ""} en stock, por debajo del umbral configurado (${product.lowStockThreshold}).\n\nRevisa tu inventario para reponer existencias.`,
          }).catch(() => {});
        }
      }

      return { success: true };
    }),

  createBatch: protectedProcedure
    .input(
      z.object({
        type: z.enum(["sale", "restock", "adjustment"]),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().int().min(1),
          unitPrice: z.string().optional(),
          currency: z.enum(["USD", "CUP"]).optional(),
          notes: z.string().optional(),
        })).min(1, "Agrega al menos un producto"),
        shippingCost: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const typeLabel = input.type === "sale" ? "Venta" : input.type === "restock" ? "Restock" : "Ajuste";
      const results: string[] = [];

      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        // shippingCost only on the first item to avoid duplication in totals
        await createMovement({
          productId: item.productId,
          type: input.type,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          shippingCost: i === 0 ? (input.shippingCost ?? "0") : "0",
          currency: item.currency ?? "USD",
          notes: item.notes ?? input.notes,
          createdBy: ctx.user.id,
        });

        const product = await getProductById(item.productId);
        results.push(product?.name ?? `#${item.productId}`);

        await logActivity({
          userId: ctx.user.id,
          userName: ctx.user.name ?? undefined,
          action: `Registró ${typeLabel.toLowerCase()}`,
          entityType: "movement",
          details: `${typeLabel} de ${item.quantity} uds de "${product?.name ?? item.productId}"${
            item.unitPrice ? ` a ${item.unitPrice} ${item.currency ?? "USD"}` : ""
          }`,
        });

        // Auto-notify on low stock after sale/adjustment
        if ((input.type === "sale" || input.type === "adjustment") && product) {
          if (product.stock <= product.lowStockThreshold) {
            notifyOwner({
              title: `⚠️ Stock bajo: ${product.name}`,
              content: `El producto "${product.name}" tiene ${product.stock} unidad${product.stock !== 1 ? "es" : ""} en stock, por debajo del umbral (${product.lowStockThreshold}).`,
            }).catch(() => {});
          }
        }
      }

      return { success: true, count: input.items.length, products: results };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await deleteMovement(input.id);
      await logActivity({
        userId: ctx.user.id,
        userName: ctx.user.name ?? undefined,
        action: "Eliminó movimiento",
        entityType: "movement",
        entityId: input.id,
        details: `Movimiento #${input.id} eliminado`,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      quantity: z.number().int().min(1).optional(),
      unitPrice: z.string().optional(),
      shippingCost: z.string().optional(),
      currency: z.enum(["USD", "CUP"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updateMovement(id, data);
      await logActivity({
        userId: ctx.user.id,
        userName: ctx.user.name ?? undefined,
        action: "Editó movimiento",
        entityType: "movement",
        entityId: id,
        details: `Movimiento #${id} actualizado`,
      });
      return { success: true };
    }),
});

// ─── Dashboard Router ─────────────────────────────────────────────────────────
const dashboardRouter = router({
  stats: protectedProcedure.query(() => getDashboardStats()),
  salesChart: protectedProcedure
    .input(z.object({ days: z.number().optional() }).optional())
    .query(({ input }) => getSalesChartData(input?.days ?? 30)),
  topProducts: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(({ input }) => getTopProducts(input?.limit ?? 5)),
  balance: protectedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
      }).optional()
    )
    .query(({ input }) => getBalanceSummary(input?.from, input?.to)),
});

// ─── Settings Router ──────────────────────────────────────────────────────────
const settingsRouter = router({
  getAll: protectedProcedure.query(() => getAllSettings()),

  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(({ input }) => getSetting(input.key)),

  set: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await setSetting(input.key, input.value, ctx.user.id);
      return { success: true };
    }),
});

// ─── Invitations Router ───────────────────────────────────────────────────────
const invitationsRouter = router({
  create: protectedProcedure
    .input(z.object({ origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admin can invite users" });
      }
      const token = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await createInvitation({ token, createdBy: ctx.user.id, expiresAt });
      return { token, inviteUrl: `${input.origin}/invite/${token}` };
    }),

  validate: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const inv = await getInvitationByToken(input.token);
      if (!inv) return { valid: false, reason: "not_found" };
      if (inv.usedAt) return { valid: false, reason: "already_used" };
      if (inv.expiresAt < new Date()) return { valid: false, reason: "expired" };
      return { valid: true };
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const inv = await getInvitationByToken(input.token);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      if (inv.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Already used" });
      if (inv.expiresAt < new Date())
        throw new TRPCError({ code: "BAD_REQUEST", message: "Expired" });
      await markInvitationUsed(input.token, ctx.user.id);
      return { success: true };
    }),

  listActive: protectedProcedure.query(({ ctx }) => getActiveInvitations(ctx.user.id)),
});

// // ─── Notifications Router ────────────────────────────────────────────
const notificationsRouter = router({
  // In-app notifications
  list: protectedProcedure.query(({ ctx }) => getNotificationsForUser(ctx.user.id)),
  unreadCount: protectedProcedure.query(({ ctx }) => getUnreadCount(ctx.user.id)),
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => markNotificationRead(input.id, ctx.user.id)),
  markAllRead: protectedProcedure
    .mutation(({ ctx }) => markAllNotificationsRead(ctx.user.id)),

  checkLowStock: protectedProcedure.mutation(async () => {
    const lowStockItems = await getLowStockProducts();
    if (lowStockItems.length === 0) {
      return { sent: false, count: 0, message: "No hay productos con stock bajo" };
    }

    const itemsList = lowStockItems
      .map((p) => `• ${p.name}: ${p.stock} uds (umbral: ${p.lowStockThreshold})`)
      .join("\n");

    const sent = await notifyOwner({
      title: `⚠️ Alerta de stock bajo — ${lowStockItems.length} producto${lowStockItems.length !== 1 ? "s" : ""}`,
      content: `Los siguientes productos tienen stock bajo:\n\n${itemsList}\n\nRevisa tu inventario para reponer existencias.`,
    });

    return { sent, count: lowStockItems.length, items: lowStockItems };
  }),
});

// // ─── Users Router ──────────────────────────────────────────────────────────
const usersRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return getAllUsers();
  }),
});

// ─── Activity Router ─────────────────────────────────────────────────────────
const activityRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().optional(),
      userId: z.number().optional(),
      entityType: z.string().optional(),
    }).optional())
    .query(({ input }) => getActivityLog(input?.limit ?? 50, {
      userId: input?.userId,
      entityType: input?.entityType,
    })),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  products: productsRouter,
  movements: movementsRouter,
  dashboard: dashboardRouter,
  settings: settingsRouter,
  invitations: invitationsRouter,
  users: usersRouter,
  notifications: notificationsRouter,
  shipments: shipmentsRouter,
  activity: activityRouter,
});

export type AppRouter = typeof appRouter;
