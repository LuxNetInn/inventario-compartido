import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import {
  Package, Plus, Truck, CheckCircle2, Clock, XCircle,
  ChevronDown, ChevronUp, DollarSign, Loader2, Trash2, AlertCircle, Pencil, MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: {
    label: "Pendiente de envío",
    icon: Clock,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
  },
  in_transit: {
    label: "En tránsito",
    icon: Truck,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-400",
  },
  delivered: {
    label: "Entregado",
    icon: CheckCircle2,
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-400",
  },
  cancelled: {
    label: "Cancelado",
    icon: XCircle,
    color: "bg-slate-100 text-slate-500 border-slate-200",
    dot: "bg-slate-300",
  },
};

type ShipmentStatus = keyof typeof STATUS_CONFIG;

// ─── New Shipment Modal ─────────────────────────────────────────────────────────
function NewShipmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.products.list.useQuery();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [shippingCost, setShippingCost] = useState("0");
  const [currency, setCurrency] = useState<"USD" | "CUP">("USD");
  const [items, setItems] = useState([
    { productId: "", productName: "", quantity: 1, unitCost: 0, notes: "" }
  ]);

  const createMutation = trpc.shipments.create.useMutation({
    onSuccess: () => {
      toast.success("Envío creado correctamente");
      utils.shipments.list.invalidate();
      utils.shipments.stats.invalidate();
      onClose();
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => {
    setTitle(""); setNotes(""); setShippingCost("0"); setCurrency("USD");
    setItems([{ productId: "", productName: "", quantity: 1, unitCost: 0, notes: "" }]);
  };

  const addItem = () => setItems([{ productId: "", productName: "", quantity: 1, unitCost: 0, notes: "" }, ...items]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const updateItem = (i: number, field: string, value: any) => {
    setItems(items.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      // Auto-fill name when product selected
      if (field === "productId" && value) {
        const prod = (products as any[]).find((p: any) => String(p.id) === String(value));
        if (prod) {
          updated.productName = prod.name;
          updated.unitCost = parseFloat(prod.costPrice) || 0;
        }
      }
      return updated;
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(i => i.productName.trim());
    if (!validItems.length) { toast.error("Agrega al menos un producto"); return; }

    createMutation.mutate({
      title,
      notes: notes || undefined,
      shippingCost: parseFloat(shippingCost) || 0,
      currency,
      items: validItems.map(i => ({
        productId: i.productId ? parseInt(i.productId) : undefined,
        productName: i.productName,
        quantity: i.quantity,
        unitCost: i.unitCost,
        notes: i.notes || undefined,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Nuevo envío
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nombre del envío *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Compras de mayo — Ropa y accesorios" required className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Costo de envío</Label>
              <Input type="number" min="0" step="0.01" value={shippingCost}
                onChange={e => setShippingCost(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "USD" | "CUP")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD — Dólar</SelectItem>
                  <SelectItem value="CUP">CUP — Peso cubano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notas (opcional)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Detalles del envío, proveedor, etc." rows={2} className="resize-none text-sm" />
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Productos en este envío</p>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" /> Agregar producto
              </Button>
            </div>

            {items.map((item, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">Producto {i + 1}</p>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Producto del catálogo (opcional)</Label>
                    <Select value={item.productId} onValueChange={v => updateItem(i, "productId", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar del catálogo..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sin vincular al catálogo —</SelectItem>
                        {(products as any[]).map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nombre del producto *</Label>
                    <Input value={item.productName} onChange={e => updateItem(i, "productName", e.target.value)}
                      placeholder="Nombre del artículo" required className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cantidad</Label>
                    <Input type="number" min="1" value={item.quantity}
                      onChange={e => updateItem(i, "quantity", parseInt(e.target.value) || 1)}
                      className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Costo unitario</Label>
                    <Input type="number" min="0" step="0.01" value={item.unitCost}
                      onChange={e => updateItem(i, "unitCost", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onClose(); resetForm(); }}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              Crear envío
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Shipment Modal ──────────────────────────────────────────────────────────────────────────────
function EditShipmentModal({ shipment, open, onClose }: { shipment: any; open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.products.list.useQuery();

  const [title, setTitle] = useState(shipment.title);
  const [notes, setNotes] = useState(shipment.notes ?? "");
  const [shippingCost, setShippingCost] = useState(String(parseFloat(shipment.shippingCost) || 0));
  const [currency, setCurrency] = useState<"USD" | "CUP">(shipment.currency ?? "USD");
  const [items, setItems] = useState<any[]>(
    shipment.items.map((i: any) => ({
      id: i.id,
      productId: i.productId ? String(i.productId) : "",
      productName: i.productName,
      quantity: i.quantity,
      unitCost: parseFloat(i.unitCost) || 0,
      notes: i.notes ?? "",
    }))
  );

  // Reset form when shipment changes
  const resetToShipment = () => {
    setTitle(shipment.title);
    setNotes(shipment.notes ?? "");
    setShippingCost(String(parseFloat(shipment.shippingCost) || 0));
    setCurrency(shipment.currency ?? "USD");
    setItems(shipment.items.map((i: any) => ({
      id: i.id,
      productId: i.productId ? String(i.productId) : "",
      productName: i.productName,
      quantity: i.quantity,
      unitCost: parseFloat(i.unitCost) || 0,
      notes: i.notes ?? "",
    })));
  };

  const updateMutation = trpc.shipments.update.useMutation({
    onSuccess: () => {
      toast.success("Envío actualizado correctamente");
      utils.shipments.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const addItem = () => setItems([{ productId: "", productName: "", quantity: 1, unitCost: 0, notes: "" }, ...items]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const updateItem = (i: number, field: string, value: any) => {
    setItems(items.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      if (field === "productId" && value) {
        const prod = (products as any[]).find((p: any) => String(p.id) === String(value));
        if (prod) { updated.productName = prod.name; updated.unitCost = parseFloat(prod.costPrice) || 0; }
      }
      return updated;
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(i => i.productName.trim());
    if (!validItems.length) { toast.error("Agrega al menos un producto"); return; }
    updateMutation.mutate({
      id: shipment.id,
      title,
      notes: notes || undefined,
      shippingCost: parseFloat(shippingCost) || 0,
      currency,
      items: validItems.map(i => ({
        id: i.id,
        productId: i.productId ? parseInt(i.productId) : undefined,
        productName: i.productName,
        quantity: i.quantity,
        unitCost: i.unitCost,
        notes: i.notes || undefined,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetToShipment(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            Editar envío
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nombre del envío *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Compras de mayo" required className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Costo de envío</Label>
              <Input type="number" min="0" step="0.01" value={shippingCost}
                onChange={e => setShippingCost(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "USD" | "CUP")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD — Dólar</SelectItem>
                  <SelectItem value="CUP">CUP — Peso cubano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notas (opcional)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Detalles del envío..." rows={2} className="resize-none text-sm" />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Productos en este envío</p>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" /> Agregar producto
              </Button>
            </div>

            {items.map((item, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">Producto {i + 1}</p>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Producto del catálogo (opcional)</Label>
                    <Select value={item.productId} onValueChange={v => updateItem(i, "productId", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar del catálogo..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sin vincular al catálogo —</SelectItem>
                        {(products as any[]).map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nombre del producto *</Label>
                    <Input value={item.productName} onChange={e => updateItem(i, "productName", e.target.value)}
                      placeholder="Nombre del artículo" required className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cantidad</Label>
                    <Input type="number" min="1" value={item.quantity}
                      onChange={e => updateItem(i, "quantity", parseInt(e.target.value) || 1)}
                      className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Costo unitario</Label>
                    <Input type="number" min="0" step="0.01" value={item.unitCost}
                      onChange={e => updateItem(i, "unitCost", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onClose(); resetToShipment(); }}>Cancelar</Button>
            <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shipment Card ──────────────────────────────────────────────────────────────────────────────
function ShipmentCard({ shipment }: { shipment: any }) { const { user } = useAuth();
  const { format: formatAmount } = useCurrency();
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyWhatsApp = () => {
    const lines: string[] = [];
    lines.push(`📦 *${shipment.title}*`);
    lines.push("");
    lines.push("*Productos:*");
    for (const item of shipment.items) {
      const cost = parseFloat(item.unitCost) || 0;
      const total = cost * item.quantity;
      lines.push(`• ${item.productName} x${item.quantity} — ${total.toFixed(2)} ${shipment.currency}`);
    }
    if (parseFloat(shipment.shippingCost) > 0) {
      lines.push("");
      lines.push(`🚚 *Costo de envío:* ${parseFloat(shipment.shippingCost).toFixed(2)} ${shipment.currency}`);
    }
    const total = shipment.items.reduce((s: number, i: any) =>
      s + (parseFloat(i.unitCost) || 0) * i.quantity, 0
    ) + (parseFloat(shipment.shippingCost) || 0);
    lines.push("");
    lines.push(`💰 *Total: ${total.toFixed(2)} ${shipment.currency}*`);
    if (shipment.notes) {
      lines.push("");
      lines.push(`📝 ${shipment.notes}`);
    }
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      toast.success("Resumen copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error("No se pudo copiar al portapapeles");
    });
  };

  const config = STATUS_CONFIG[shipment.status as ShipmentStatus] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  const markSentMutation = trpc.shipments.markSent.useMutation({
    onSuccess: () => {
      toast.success("¡Envío marcado como enviado! Tu hermana recibirá una notificación.");
      utils.shipments.list.invalidate();
      utils.shipments.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmMutation = trpc.shipments.confirmReceived.useMutation({
    onSuccess: (data) => {
      toast.success(`¡Recepción confirmada! Stock actualizado en ${data.stockUpdated} producto(s).`);
      utils.shipments.list.invalidate();
      utils.shipments.stats.invalidate();
      utils.products.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMutation = trpc.shipments.cancel.useMutation({
    onSuccess: () => {
      toast.success("Envío cancelado");
      utils.shipments.list.invalidate();
      utils.shipments.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const changeStatusMutation = trpc.shipments.changeStatus.useMutation({
    onSuccess: (data) => {
      const labels: Record<string, string> = {
        pending: "Pendiente",
        in_transit: "En tránsito",
        delivered: "Entregado",
        cancelled: "Cancelado",
      };
      toast.success(`Estado cambiado a "${labels[data.newStatus] ?? data.newStatus}"`);
      utils.shipments.list.invalidate();
      utils.shipments.stats.invalidate();
      utils.products.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalCost = shipment.items.reduce((sum: number, i: any) =>
    sum + (parseFloat(i.unitCost) || 0) * i.quantity, 0
  ) + (parseFloat(shipment.shippingCost) || 0);

  return (
    <>
    <Card className={cn("shadow-card transition-all duration-200", shipment.status === "cancelled" && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
              shipment.status === "pending" ? "bg-amber-100" :
              shipment.status === "in_transit" ? "bg-blue-100" :
              shipment.status === "delivered" ? "bg-emerald-100" : "bg-slate-100"
            )}>
              <StatusIcon className={cn("w-4 h-4",
                shipment.status === "pending" ? "text-amber-600" :
                shipment.status === "in_transit" ? "text-blue-600" :
                shipment.status === "delivered" ? "text-emerald-600" : "text-slate-400"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{shipment.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(shipment.createdAt).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                {shipment.sentAt && ` · Enviado: ${new Date(shipment.sentAt).toLocaleDateString("es", { day: "numeric", month: "short" })}`}
                {shipment.receivedAt && ` · Recibido: ${new Date(shipment.receivedAt).toLocaleDateString("es", { day: "numeric", month: "short" })}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", config.color)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
              {config.label}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Summary row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{shipment.items.length} producto{shipment.items.length !== 1 ? "s" : ""}</span>
          <span className="font-semibold text-foreground">
            Total: {formatAmount(totalCost, shipment.currency)}
          </span>
        </div>

        {/* Expand/collapse items */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <span>{expanded ? "Ocultar productos" : "Ver productos"}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {expanded && (
          <div className="space-y-1.5 pt-1">
            {shipment.items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-xs">
                <div>
                  <p className="font-medium text-foreground">{item.productName}</p>
                  {item.notes && <p className="text-muted-foreground mt-0.5">{item.notes}</p>}
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="font-semibold">{item.quantity} uds.</p>
                  <p className="text-muted-foreground">{formatAmount(parseFloat(item.unitCost) * item.quantity, shipment.currency)}</p>
                </div>
              </div>
            ))}
            {parseFloat(shipment.shippingCost) > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Truck className="w-3 h-3" /> Costo de envío
                </span>
                <span className="font-semibold">{formatAmount(parseFloat(shipment.shippingCost), shipment.currency)}</span>
              </div>
            )}
            {shipment.notes && (
              <div className="p-2.5 rounded-lg bg-muted/20 text-xs text-muted-foreground">
                <span className="font-medium">Notas: </span>{shipment.notes}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {/* Copy for WhatsApp — always visible */}
          <Button
            size="sm"
            variant="outline"
            onClick={copyWhatsApp}
            className="gap-1.5 h-8 text-xs"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <MessageCircle className="w-3.5 h-3.5" />}
            {copied ? "¡Copiado!" : "Copiar WhatsApp"}
          </Button>

          {/* Admin: edit shipment (any non-cancelled state) */}
          {user?.role === "admin" && shipment.status !== "cancelled" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEdit(true)}
              className="gap-1.5 h-8 text-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </Button>
          )}

          {/* Admin: change status selector */}
          {user?.role === "admin" && (
            <Select
              value={shipment.status}
              onValueChange={(newStatus) => {
                if (newStatus === shipment.status) return;
                const labels: Record<string, string> = {
                  pending: "Pendiente",
                  in_transit: "En tránsito",
                  delivered: "Entregado",
                  cancelled: "Cancelado",
                };
                if (confirm(`¿Cambiar estado a "${labels[newStatus]}"?`)) {
                  changeStatusMutation.mutate({ id: shipment.id, status: newStatus as any });
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs w-auto min-w-[130px] gap-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_transit">En tránsito</SelectItem>
                <SelectItem value="delivered">Entregado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Non-admin: confirm receipt when in transit */}
          {user?.role !== "admin" && shipment.status === "in_transit" && (
            <Button
              size="sm"
              onClick={() => confirmMutation.mutate({ id: shipment.id })}
              disabled={confirmMutation.isPending}
              className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {confirmMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Confirmar recepción
            </Button>
          )}

          {/* Status banner for delivered */}
          {shipment.status === "delivered" && user?.role !== "admin" && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Entregado — stock actualizado</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    {showEdit && (
      <EditShipmentModal
        shipment={shipment}
        open={showEdit}
        onClose={() => setShowEdit(false)}
      />
    )}
    </>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "in_transit", label: "En tránsito" },
  { value: "delivered", label: "Entregados" },
  { value: "cancelled", label: "Cancelados" },
];

export default function Shipments() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: shipmentList = [], isLoading } = trpc.shipments.list.useQuery();
  const { data: stats } = trpc.shipments.stats.useQuery();

  const filtered = (shipmentList as any[]).filter((s: any) =>
    statusFilter === "all" || s.status === statusFilter
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Envíos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Seguimiento de productos comprados y su estado de entrega
          </p>
        </div>
        {user?.role === "admin" && (
          <Button onClick={() => setShowModal(true)} className="gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" />
            Nuevo envío
          </Button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 animate-fade-in">
          {[
            { label: "Pendientes", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "En tránsito", value: stats.inTransit, icon: Truck, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Entregados", value: stats.delivered, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="shadow-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bg)}>
                  <Icon className={cn("w-4 h-4", color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Collaborator notice */}
      {user?.role !== "admin" && (stats?.inTransit ?? 0) > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">
              Tienes {stats!.inTransit} envío{stats!.inTransit !== 1 ? "s" : ""} en camino
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              Cuando lleguen, haz clic en "Confirmar recepción" para actualizar el inventario automáticamente.
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 w-fit">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
              statusFilter === f.value
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
            {f.value !== "all" && stats && (
              <span className="ml-1.5 opacity-60">
                {f.value === "pending" ? stats.pending :
                 f.value === "in_transit" ? stats.inTransit :
                 f.value === "delivered" ? stats.delivered : ""}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Shipment list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
            <Package className="w-7 h-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {statusFilter === "all" ? "No hay envíos registrados aún" : `No hay envíos ${STATUS_CONFIG[statusFilter as ShipmentStatus]?.label.toLowerCase() ?? ""}`}
          </p>
          {user?.role === "admin" && statusFilter === "all" && (
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setShowModal(true)}>
              <Plus className="w-3.5 h-3.5" /> Crear primer envío
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((s: any) => (
            <ShipmentCard key={s.id} shipment={s} />
          ))}
        </div>
      )}

      <NewShipmentModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
