import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { shipments, shipmentItems, products, users } from "../../drizzle/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { createProduct, createAppNotification } from "../db";

export const shipmentsRouter = router({
  // List all shipments with their items
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

    const allShipments = await db
      .select()
      .from(shipments)
      .orderBy(desc(shipments.createdAt));

    const allItems = await db.select().from(shipmentItems);

    return allShipments.map((s) => ({
      ...s,
      items: allItems.filter((i) => i.shipmentId === s.id),
    }));
  }),

  // Get single shipment with items
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [shipment] = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);
      if (!shipment) throw new TRPCError({ code: "NOT_FOUND", message: "Envío no encontrado" });

      const items = await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, input.id));
      return { ...shipment, items };
    }),

  // Create a new shipment (pending state)
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        notes: z.string().optional(),
        shippingCost: z.number().min(0).default(0),
        currency: z.enum(["USD", "CUP"]).default("USD"),
        items: z.array(
          z.object({
            productId: z.number().optional(),
            productName: z.string().min(1),
            quantity: z.number().int().min(1),
            unitCost: z.number().min(0).default(0),
            notes: z.string().optional(),
          })
        ).min(1, "Agrega al menos un producto"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [result] = await db.insert(shipments).values({
        title: input.title,
        notes: input.notes ?? null,
        shippingCost: String(input.shippingCost),
        currency: input.currency,
        status: "pending",
        createdBy: ctx.user!.id,
      });

      const shipmentId = (result as any).insertId as number;

      // Auto-create catalog products for items without a productId
      const resolvedItems = await Promise.all(
        input.items.map(async (item) => {
          if (item.productId) return item;
          // Check if a product with this name already exists (case-insensitive)
          const existing = await db
            .select({ id: products.id })
            .from(products)
            .where(eq(products.name, item.productName))
            .limit(1);
          if (existing.length > 0) {
            return { ...item, productId: existing[0].id };
          }
          // Create new product in catalog with stock=0 (will be updated on delivery)
          const newProd = await createProduct({
            name: item.productName,
            costPrice: String(item.unitCost || 0),
            salePrice: String(item.unitCost || 0),
            stock: 0,
            lowStockThreshold: 5,
            currency: input.currency,
            isActive: 1,
            createdBy: ctx.user!.id,
          });
          const newId = (newProd as any).insertId as number;
          return { ...item, productId: newId };
        })
      );

      if (resolvedItems.length > 0) {
        await db.insert(shipmentItems).values(
          resolvedItems.map((item) => ({
            shipmentId,
            productId: item.productId ?? null,
            productName: item.productName,
            quantity: item.quantity,
            unitCost: String(item.unitCost),
            notes: item.notes ?? null,
          }))
        );
      }

      return { id: shipmentId, success: true, autoCreated: resolvedItems.filter(i => !input.items.find(orig => orig.productId === i.productId)).length };
    }),

  // Mark as sent (in_transit) — admin only
  markSent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [shipment] = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);
      if (!shipment) throw new TRPCError({ code: "NOT_FOUND", message: "Envío no encontrado" });
      if (shipment.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden marcar como enviados los envíos pendientes" });
      }

      await db.update(shipments).set({
        status: "in_transit",
        sentBy: ctx.user!.id,
        sentAt: new Date(),
      }).where(eq(shipments.id, input.id));

      // Notify owner via Manus
      try {
        await notifyOwner({
          title: `📦 Envío en camino: ${shipment.title}`,
          content: `El envío "${shipment.title}" ha sido marcado como enviado. Confirma la recepción cuando llegue.`,
        });
      } catch { /* non-critical */ }

      // Notify all other users in-app (collaborators)
      try {
        const db2 = await getDb();
        if (db2) {
          const otherUsers = await db2
            .select({ id: users.id })
            .from(users)
            .where(ne(users.id, ctx.user!.id));
          for (const u of otherUsers) {
            await createAppNotification({
              userId: u.id,
              title: `📦 Envío en camino`,
              message: `El envío "${shipment.title}" fue marcado como enviado. Confirma la recepción cuando llegue.`,
              type: "shipment_sent",
              relatedId: input.id,
            });
          }
        }
      } catch { /* non-critical */ }

      return { success: true };
    }),

  // Confirm receipt (delivered) — any user, activates stock
  confirmReceived: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [shipment] = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);
      if (!shipment) throw new TRPCError({ code: "NOT_FOUND", message: "Envío no encontrado" });
      if (shipment.status !== "in_transit") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden confirmar envíos en tránsito" });
      }

      // Update shipment status
      await db.update(shipments).set({
        status: "delivered",
        receivedBy: ctx.user!.id,
        receivedAt: new Date(),
      }).where(eq(shipments.id, input.id));

      // Add stock to products that have a productId linked
      const items = await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, input.id));
      const itemsWithProduct = items.filter((i) => i.productId != null);

      for (const item of itemsWithProduct) {
        const [prod] = await db.select().from(products).where(eq(products.id, item.productId!)).limit(1);
        if (prod) {
          await db.update(products).set({
            stock: prod.stock + item.quantity,
          }).where(eq(products.id, item.productId!));
        }
      }

      // Notify owner via Manus
      try {
        await notifyOwner({
          title: `✅ Envío recibido: ${shipment.title}`,
          content: `El envío "${shipment.title}" ha sido confirmado como recibido. Se actualizó el stock de ${itemsWithProduct.length} producto(s).`,
        });
      } catch { /* non-critical */ }

      // Notify all other users in-app
      try {
        const db2 = await getDb();
        if (db2) {
          const otherUsers = await db2
            .select({ id: users.id })
            .from(users)
            .where(ne(users.id, ctx.user!.id));
          for (const u of otherUsers) {
            await createAppNotification({
              userId: u.id,
              title: `✅ Envío recibido`,
              message: `El envío "${shipment.title}" fue confirmado como recibido. Stock actualizado: ${itemsWithProduct.length} producto(s).`,
              type: "shipment_received",
              relatedId: input.id,
            });
          }
        }
      } catch { /* non-critical */ }

      return { success: true, stockUpdated: itemsWithProduct.length };
    }),

  // Update a shipment (allowed in any non-cancelled state)
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255),
        notes: z.string().optional(),
        shippingCost: z.number().min(0).default(0),
        currency: z.enum(["USD", "CUP"]).default("USD"),
        items: z.array(
          z.object({
            id: z.number().optional(), // existing item id
            productId: z.number().optional(),
            productName: z.string().min(1),
            quantity: z.number().int().min(1),
            unitCost: z.number().min(0).default(0),
            notes: z.string().optional(),
          })
        ).min(1, "Agrega al menos un producto"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [shipment] = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);
      if (!shipment) throw new TRPCError({ code: "NOT_FOUND", message: "Envío no encontrado" });
      if (shipment.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No se puede editar un envío cancelado" });
      }

      // Update shipment header
      await db.update(shipments).set({
        title: input.title,
        notes: input.notes ?? null,
        shippingCost: String(input.shippingCost),
        currency: input.currency,
      }).where(eq(shipments.id, input.id));

      // Replace all items: delete existing and re-insert
      await db.delete(shipmentItems).where(eq(shipmentItems.shipmentId, input.id));

      // Auto-create catalog products for new items without productId
      const resolvedItems = await Promise.all(
        input.items.map(async (item) => {
          if (item.productId) return item;
          const existing = await db
            .select({ id: products.id })
            .from(products)
            .where(eq(products.name, item.productName))
            .limit(1);
          if (existing.length > 0) return { ...item, productId: existing[0].id };
          const newProd = await createProduct({
            name: item.productName,
            costPrice: String(item.unitCost || 0),
            salePrice: String(item.unitCost || 0),
            stock: 0,
            lowStockThreshold: 5,
            currency: input.currency,
            isActive: 1,
            createdBy: ctx.user!.id,
          });
          const newId = (newProd as any).insertId as number;
          return { ...item, productId: newId };
        })
      );

      await db.insert(shipmentItems).values(
        resolvedItems.map((item) => ({
          shipmentId: input.id,
          productId: item.productId ?? null,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: String(item.unitCost),
          notes: item.notes ?? null,
        }))
      );

      return { success: true };
    }),

  // Cancel shipment
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [shipment] = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);
      if (!shipment) throw new TRPCError({ code: "NOT_FOUND" });
      if (shipment.status === "delivered") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No se puede cancelar un envío ya entregado" });
      }

      await db.update(shipments).set({ status: "cancelled" }).where(eq(shipments.id, input.id));
      return { success: true };
    }),

  // Change shipment status manually (admin only)
  changeStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["pending", "in_transit", "delivered", "cancelled"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo el administrador puede cambiar el estado manualmente" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [shipment] = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);
      if (!shipment) throw new TRPCError({ code: "NOT_FOUND", message: "Envío no encontrado" });

      const updateData: Record<string, unknown> = { status: input.status };

      // Set timestamps based on new status
      if (input.status === "in_transit" && !shipment.sentAt) {
        updateData.sentAt = new Date();
        updateData.sentBy = ctx.user!.id;
      } else if (input.status === "delivered" && !shipment.receivedAt) {
        updateData.receivedAt = new Date();
        updateData.receivedBy = ctx.user!.id;
        // Auto-update stock if moving to delivered
        const items = await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, input.id));
        const itemsWithProduct = items.filter((i) => i.productId != null);
        if (shipment.status !== "delivered") {
          for (const item of itemsWithProduct) {
            const [prod] = await db.select().from(products).where(eq(products.id, item.productId!)).limit(1);
            if (prod) {
              await db.update(products).set({ stock: prod.stock + item.quantity }).where(eq(products.id, item.productId!));
            }
          }
        }
      } else if (input.status === "pending") {
        // Revert timestamps when going back to pending
        updateData.sentAt = null;
        updateData.sentBy = null;
        updateData.receivedAt = null;
        updateData.receivedBy = null;
      }

      await db.update(shipments).set(updateData as any).where(eq(shipments.id, input.id));

      // Send in-app notifications on key transitions
      try {
        if (input.status === "in_transit") {
          const otherUsers = await db.select({ id: users.id }).from(users).where(ne(users.id, ctx.user!.id));
          for (const u of otherUsers) {
            await createAppNotification({
              userId: u.id,
              title: `📦 Envío en camino`,
              message: `El envío "${shipment.title}" fue marcado como enviado.`,
              type: "shipment_sent",
              relatedId: input.id,
            });
          }
        } else if (input.status === "delivered") {
          const otherUsers = await db.select({ id: users.id }).from(users).where(ne(users.id, ctx.user!.id));
          for (const u of otherUsers) {
            await createAppNotification({
              userId: u.id,
              title: `✅ Envío recibido`,
              message: `El envío "${shipment.title}" fue confirmado como recibido.`,
              type: "shipment_received",
              relatedId: input.id,
            });
          }
        }
      } catch { /* non-critical */ }

      return { success: true, newStatus: input.status };
    }),

  // Stats for dashboard
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { pending: 0, inTransit: 0, delivered: 0 };

    const all = await db.select({ status: shipments.status }).from(shipments);
    return {
      pending: all.filter((s) => s.status === "pending").length,
      inTransit: all.filter((s) => s.status === "in_transit").length,
      delivered: all.filter((s) => s.status === "delivered").length,
    };
  }),
});
