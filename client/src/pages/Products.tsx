import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToExcel, formatProductsForExport } from "@/lib/export";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { z as ZodType } from "zod";
import {
  Plus, Search, Edit2, Trash2, History, Package, AlertTriangle,
  ChevronDown, X, TrendingUp, TrendingDown, ArrowUpDown
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const productSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  category: z.string().optional(),
  costPrice: z.string().min(1, "Precio de costo requerido"),
  salePrice: z.string().min(1, "Precio de venta requerido"),
  stock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  currency: z.enum(["USD", "CUP"]),
});

type ProductForm = z.infer<typeof productSchema>;

function PriceHistoryModal({ productId, productName, onClose }: {
  productId: number; productName: string; onClose: () => void;
}) {
  const { data: history, isLoading } = trpc.products.priceHistory.useQuery({ productId });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Historial de precios — {productName}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto space-y-2 py-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-14 rounded-lg animate-shimmer" />
              ))}
            </div>
          ) : !history?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin cambios de precio registrados</p>
            </div>
          ) : (
            history.map((h) => {
              const old = parseFloat(h.oldPrice as string);
              const newP = parseFloat(h.newPrice as string);
              const diff = newP - old;
              const isIncrease = diff > 0;
              return (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={h.priceType === "sale" ? "default" : "secondary"} className="text-xs">
                        {h.priceType === "sale" ? "Venta" : "Costo"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.changedAt).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {old.toFixed(2)} → <span className="font-semibold text-foreground">{newP.toFixed(2)}</span>
                    </p>
                  </div>
                  <div className={cn("flex items-center gap-1 text-sm font-semibold", isIncrease ? "text-emerald-600" : "text-red-500")}>
                    {isIncrease ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {isIncrease ? "+" : ""}{diff.toFixed(2)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductModal({ product, onClose }: {
  product?: any; onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); toast.success("Producto creado"); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); toast.success("Producto actualizado"); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm<ProductForm, unknown, ProductForm>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: product ? {
      name: product.name,
      category: product.category || "",
      costPrice: String(product.costPrice),
      salePrice: String(product.salePrice),
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      supplier: product.supplier || "",
      notes: product.notes || "",
      currency: product.currency || "USD",
    } : {
      name: "", category: "", costPrice: "", salePrice: "",
      stock: 0, lowStockThreshold: 5, supplier: "", notes: "", currency: "USD",
    },
  });

  const onSubmit = (data: ProductForm) => {
    if (product) {
      updateMutation.mutate({ id: product.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            {product ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nombre del producto *</FormLabel>
                  <FormControl><Input placeholder="Ej: Camiseta talla M" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <FormControl><Input placeholder="Ej: Ropa, Electrónica" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD — Dólar</SelectItem>
                      <SelectItem value="CUP">CUP — Peso cubano</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="costPrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio de costo *</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="salePrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio de venta *</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stock" render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock actual</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                <FormItem>
                  <FormLabel>Alerta de stock bajo</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="supplier" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Proveedor</FormLabel>
                  <FormControl><Input placeholder="Nombre del proveedor" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Notas</FormLabel>
                  <FormControl><Textarea placeholder="Notas adicionales..." rows={3} {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : product ? "Guardar cambios" : "Crear producto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Products() {
  const { format } = useCurrency();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "costPrice" | "salePrice" | "createdAt">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editProduct, setEditProduct] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<any>(null);

  const { data: products = [], isLoading } = trpc.products.list.useQuery({});
  const utils = trpc.useUtils();
  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); toast.success("Producto eliminado"); },
    onError: (e) => toast.error(e.message),
  });

  const categories = ["all", ...Array.from(new Set(products.map((p: any) => p.category).filter(Boolean)))];

  const filtered = products
    .filter((p: any) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.supplier || "").toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      return matchSearch && matchCat;
    })
    .sort((a: any, b: any) => {
      let valA: any, valB: any;
      if (sortBy === "name") {
        valA = a.name.toLowerCase(); valB = b.name.toLowerCase();
      } else if (sortBy === "costPrice") {
        valA = parseFloat(a.costPrice); valB = parseFloat(b.costPrice);
      } else if (sortBy === "salePrice") {
        valA = parseFloat(a.salePrice); valB = parseFloat(b.salePrice);
      } else {
        valA = new Date(a.createdAt).getTime(); valB = new Date(b.createdAt).getTime();
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const handleDelete = (id: number, name: string) => {
    if (confirm(`¿Eliminar "${name}"?`)) deleteMutation.mutate({ id });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Productos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {products.length} producto{products.length !== 1 ? "s" : ""} en catálogo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            disabled={products.length === 0}
            onExportCSV={() => exportToCSV(formatProductsForExport(filtered), "productos")}
            onExportExcel={() => exportToExcel([{ name: "Productos", data: formatProductsForExport(filtered) }], "inventario-productos")}
          />
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo producto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c === "all" ? "Todas las categorías" : c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Sort controls */}
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nombre (A–Z)</SelectItem>
              <SelectItem value="costPrice">Precio de costo</SelectItem>
              <SelectItem value="salePrice">Precio de venta</SelectItem>
              <SelectItem value="createdAt">Fecha de creación</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
            className="flex-shrink-0 w-9 h-9 rounded-md border border-input bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={sortDir === "asc" ? "Ascendente — clic para invertir" : "Descendente — clic para invertir"}
          >
            <ArrowUpDown className="w-4 h-4" style={{ transform: sortDir === "desc" ? "scaleY(-1)" : "none", transition: "transform 200ms" }} />
          </button>
        </div>
      </div>

      {/* Products Table */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-12 rounded-lg animate-shimmer" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {search || categoryFilter !== "all" ? "Sin resultados" : "No hay productos aún"}
              </p>
              {!search && categoryFilter === "all" && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Agregar primer producto
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Producto</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Categoría</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Costo</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Venta</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Margen</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Stock</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Proveedor</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((p: any) => {
                    const cost = parseFloat(p.costPrice);
                    const sale = parseFloat(p.salePrice);
                    const margin = sale > 0 ? ((sale - cost) / sale * 100).toFixed(1) : "0";
                    const isLow = p.stock <= p.lowStockThreshold;
                    return (
                      <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Package className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{p.name}</p>
                              {p.notes && <p className="text-xs text-muted-foreground truncate max-w-32">{p.notes}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {p.category ? (
                            <Badge variant="secondary" className="text-xs">{p.category}</Badge>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-numeric text-muted-foreground">
                          {format(cost)}
                        </td>
                        <td className="px-4 py-3 text-right font-numeric font-semibold text-foreground">
                          {format(sale)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-full",
                            parseFloat(margin) > 30 ? "bg-emerald-100 text-emerald-700" :
                            parseFloat(margin) > 10 ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {margin}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={cn("font-semibold font-numeric", isLow ? "text-red-600" : "text-foreground")}>
                              {p.stock}
                            </span>
                            {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                          {p.supplier || <span className="opacity-30">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost" size="icon"
                              className="w-7 h-7 text-muted-foreground hover:text-primary"
                              onClick={() => setHistoryProduct(p)}
                              title="Historial de precios"
                            >
                              <History className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="w-7 h-7 text-muted-foreground hover:text-primary"
                              onClick={() => setEditProduct(p)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="w-7 h-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(p.id, p.name)}
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

      {/* Modals */}
      {showCreate && <ProductModal onClose={() => setShowCreate(false)} />}
      {editProduct && <ProductModal product={editProduct} onClose={() => setEditProduct(null)} />}
      {historyProduct && (
        <PriceHistoryModal
          productId={historyProduct.id}
          productName={historyProduct.name}
          onClose={() => setHistoryProduct(null)}
        />
      )}
    </div>
  );
}
