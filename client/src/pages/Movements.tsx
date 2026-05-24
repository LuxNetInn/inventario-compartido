import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToExcel, formatMovementsForExport } from "@/lib/export";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, ShoppingCart, Package, RefreshCw, SlidersHorizontal,
  TrendingUp, Truck, Filter, Search, Pencil, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const movementSchema = z.object({
  productId: z.coerce.number().min(1, "Selecciona un producto"),
  type: z.enum(["sale", "restock", "adjustment"]),
  quantity: z.coerce.number().int().min(1, "Cantidad mínima: 1"),
  unitPrice: z.string().optional(),
  shippingCost: z.string().optional(),
  currency: z.enum(["USD", "CUP"]),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.type === "sale" && (!data.unitPrice || parseFloat(data.unitPrice) <= 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El precio unitario es requerido para ventas", path: ["unitPrice"] });
  }
});

const editMovementSchema = z.object({
  quantity: z.coerce.number().int().min(1, "Cantidad mínima: 1"),
  unitPrice: z.string().optional(),
  shippingCost: z.string().optional(),
  currency: z.enum(["USD", "CUP"]),
  notes: z.string().optional(),
});

type MovementForm = z.infer<typeof movementSchema>;
type EditMovementForm = z.infer<typeof editMovementSchema>;

const typeConfig = {
  sale: { label: "Venta", color: "bg-emerald-100 text-emerald-700", icon: ShoppingCart },
  restock: { label: "Restock", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
  adjustment: { label: "Ajuste", color: "bg-amber-100 text-amber-700", icon: SlidersHorizontal },
};

// ─── Create Modal ─────────────────────────────────────────────────────────────
function MovementModal({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.products.list.useQuery({});
  const createMutation = trpc.movements.create.useMutation({
    onSuccess: () => {
      utils.movements.listWithProducts.invalidate();
      utils.products.list.invalidate();
      utils.dashboard.stats.invalidate();
      utils.activity.list.invalidate();
      toast.success("Movimiento registrado");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm<MovementForm, unknown, MovementForm>({
    resolver: zodResolver(movementSchema) as any,
    defaultValues: {
      productId: 0, type: "sale", quantity: 1,
      unitPrice: "", shippingCost: "0", currency: "USD", notes: "",
    },
  });

  const selectedType = form.watch("type");
  const selectedProductId = form.watch("productId");
  const selectedProduct = products.find((p: any) => p.id === Number(selectedProductId));

  // Auto-fill unit price AND currency when product is selected (for sales)
  const prevProductIdRef = React.useRef<number>(0);
  React.useEffect(() => {
    const pid = Number(selectedProductId);
    if (pid && pid !== prevProductIdRef.current && selectedProduct && selectedType === "sale") {
      form.setValue("unitPrice", String(selectedProduct.salePrice || ""), { shouldValidate: false });
      form.setValue("currency", selectedProduct.currency || "USD", { shouldValidate: false });
    }
    prevProductIdRef.current = pid;
  }, [selectedProductId, selectedProduct, selectedType]);

  React.useEffect(() => {
    if (selectedType === "sale" && selectedProduct) {
      const currentPrice = form.getValues("unitPrice");
      if (!currentPrice || currentPrice === "0") {
        form.setValue("unitPrice", String(selectedProduct.salePrice || ""), { shouldValidate: false });
        form.setValue("currency", selectedProduct.currency || "USD", { shouldValidate: false });
      }
    }
  }, [selectedType]);

  const onSubmit = (data: MovementForm) => {
    createMutation.mutate({
      ...data,
      unitPrice: data.unitPrice || undefined,
      shippingCost: data.shippingCost || "0",
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            Registrar movimiento
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de movimiento</FormLabel>
                <div className="grid grid-cols-3 gap-2">
                  {(["sale", "restock", "adjustment"] as const).map((t) => {
                    const cfg = typeConfig[t];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => field.onChange(t)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-xs font-semibold",
                          field.value === t
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </FormItem>
            )} />

            <FormField control={form.control} name="productId" render={({ field }) => (
              <FormItem>
                <FormLabel>Producto *</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar producto..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} — Stock: {p.stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {selectedProduct && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 text-xs">
                <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex gap-4">
                  <span>Stock: <strong>{selectedProduct.stock}</strong></span>
                  <span>Costo: <strong>{selectedProduct.costPrice}</strong></span>
                  <span>Venta: <strong>{selectedProduct.salePrice}</strong></span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad *</FormLabel>
                  <FormControl><Input type="number" min="1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="CUP">CUP</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            {selectedType === "sale" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="unitPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio unitario</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder={selectedProduct?.salePrice || "0.00"} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="shippingCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Truck className="w-3 h-3" /> Costo de envío
                    </FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            )}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notas</FormLabel>
                <FormControl><Textarea placeholder="Observaciones..." rows={2} {...field} /></FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Registrando..." : "Registrar movimiento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditMovementModal({ movement, onClose }: { movement: any; onClose: () => void }) {
  const utils = trpc.useUtils();
  const updateMutation = trpc.movements.update.useMutation({
    onSuccess: () => {
      utils.movements.listWithProducts.invalidate();
      utils.dashboard.stats.invalidate();
      utils.activity.list.invalidate();
      toast.success("Movimiento actualizado");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm<EditMovementForm>({
    resolver: zodResolver(editMovementSchema) as any,
    defaultValues: {
      quantity: movement.quantity,
      unitPrice: movement.unitPrice ? String(movement.unitPrice) : "",
      shippingCost: movement.shippingCost ? String(movement.shippingCost) : "0",
      currency: movement.currency || "USD",
      notes: movement.notes || "",
    },
  });

  const onSubmit = (data: EditMovementForm) => {
    updateMutation.mutate({ id: movement.id, ...data });
  };

  const cfg = typeConfig[movement.type as keyof typeof typeConfig];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Editar movimiento
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-sm mb-2">
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", cfg?.color)}>
            {cfg?.label}
          </span>
          <span className="font-medium">{movement.productName}</span>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad *</FormLabel>
                  <FormControl><Input type="number" min="1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="CUP">CUP</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            {movement.type === "sale" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="unitPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio unitario</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="shippingCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Truck className="w-3 h-3" /> Costo de envío
                    </FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            )}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notas</FormLabel>
                <FormControl><Textarea placeholder="Observaciones..." rows={2} {...field} /></FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Movements() {
  const { format, convert } = useCurrency();
  const [showCreate, setShowCreate] = useState(false);
  const [editingMovement, setEditingMovement] = useState<any>(null);
  const [deletingMovement, setDeletingMovement] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const { data: movements = [], isLoading } = trpc.movements.listWithProducts.useQuery();

  const deleteMutation = trpc.movements.delete.useMutation({
    onSuccess: () => {
      utils.movements.listWithProducts.invalidate();
      utils.products.list.invalidate();
      utils.dashboard.stats.invalidate();
      utils.activity.list.invalidate();
      toast.success("Movimiento eliminado");
      setDeletingMovement(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = movements.filter((m: any) => {
    const matchType = typeFilter === "all" || m.type === typeFilter;
    const matchSearch = (m.productName || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.notes || "").toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const totalSales = movements.filter((m: any) => m.type === "sale").length;
  // Normalise each movement to USD first so the summary total is currency-agnostic
  const totalRevenue = movements
    .filter((m: any) => m.type === "sale")
    .reduce((sum: number, m: any) =>
      sum + convert(parseFloat(m.unitPrice || "0") * m.quantity, m.currency || "USD", "USD"), 0);
  const totalShipping = movements
    .filter((m: any) => m.type === "sale")
    .reduce((sum: number, m: any) =>
      sum + convert(parseFloat(m.shippingCost || "0"), m.currency || "USD", "USD"), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ventas & Movimientos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro de ventas, restock y ajustes de inventario
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            onExportCSV={() => {
              const data = formatMovementsForExport(movements as any[]);
              exportToCSV(data, "movimientos");
            }}
            onExportExcel={() => {
              const data = formatMovementsForExport(movements as any[]);
              exportToExcel([{ name: "Movimientos", data }], "movimientos");
            }}
          />
          <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Registrar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-card animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total ventas</p>
                <p className="text-2xl font-bold font-numeric mt-1">{totalSales}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingresos totales</p>
                <p className="text-2xl font-bold font-numeric mt-1">{format(totalRevenue)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Costos de envío</p>
                <p className="text-2xl font-bold font-numeric mt-1">{format(totalShipping)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Truck className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por producto o notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {["all", "sale", "restock", "adjustment"].map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(t)}
              className="text-xs"
            >
              {t === "all" ? "Todos" : typeConfig[t as keyof typeof typeConfig]?.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Movements Table */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-lg animate-shimmer" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {search || typeFilter !== "all" ? "Sin resultados" : "No hay movimientos registrados"}
              </p>
              {!search && typeFilter === "all" && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Registrar primer movimiento
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Producto</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Cantidad</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Precio unit.</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Envío</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Notas</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Fecha</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((m: any) => {
                    const cfg = typeConfig[m.type as keyof typeof typeConfig];
                    const Icon = cfg?.icon || ShoppingCart;
                    const total = (parseFloat(m.unitPrice || "0") * m.quantity);
                    return (
                      <tr key={m.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", cfg?.color)}>
                            <Icon className="w-3 h-3" />
                            {cfg?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-foreground">{m.productName}</p>
                            {m.productCategory && <p className="text-xs text-muted-foreground">{m.productCategory}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-numeric font-semibold">
                          {m.type === "sale" ? "-" : "+"}{m.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-numeric text-muted-foreground hidden md:table-cell">
                          {m.unitPrice ? format(parseFloat(m.unitPrice), m.currency) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-numeric font-semibold hidden md:table-cell">
                          {total > 0 ? format(total, m.currency) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-numeric text-muted-foreground hidden lg:table-cell">
                          {parseFloat(m.shippingCost || "0") > 0 ? format(parseFloat(m.shippingCost), m.currency) : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell max-w-32 truncate">
                          {m.notes || "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleDateString("es", {
                            day: "2-digit", month: "short", year: "numeric"
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingMovement(m)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeletingMovement(m)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showCreate && <MovementModal onClose={() => setShowCreate(false)} />}
      {editingMovement && <EditMovementModal movement={editingMovement} onClose={() => setEditingMovement(null)} />}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMovement} onOpenChange={(open) => !open && setDeletingMovement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el movimiento de <strong>{deletingMovement?.productName}</strong> ({deletingMovement?.quantity} uds)
              y el stock del producto se revertirá automáticamente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletingMovement && deleteMutation.mutate({ id: deletingMovement.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
