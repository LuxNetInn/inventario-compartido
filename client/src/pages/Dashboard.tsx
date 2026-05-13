import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Package, TrendingUp, DollarSign, AlertTriangle, ShoppingCart,
  Truck, BarChart3, ArrowUpRight, ArrowDownRight, Boxes, Bell
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line
} from "recharts";

const COLORS = [
  "oklch(0.42 0.18 264)",
  "oklch(0.62 0.17 162)",
  "oklch(0.72 0.18 55)",
  "oklch(0.55 0.22 27)",
  "oklch(0.65 0.16 300)",
];

function StatCard({
  title, value, subtitle, icon: Icon, trend, color = "primary", delay = 0
}: {
  title: string; value: string; subtitle?: string;
  icon: any; trend?: { value: number; label: string };
  color?: "primary" | "success" | "warning" | "danger"; delay?: number;
}) {
  const colorMap = {
    primary: { bg: "bg-primary/10", text: "text-primary", gradient: "from-indigo-500 to-purple-600" },
    success: { bg: "bg-emerald-100", text: "text-emerald-600", gradient: "from-emerald-500 to-teal-600" },
    warning: { bg: "bg-amber-100", text: "text-amber-600", gradient: "from-amber-500 to-orange-600" },
    danger: { bg: "bg-red-100", text: "text-red-600", gradient: "from-red-500 to-rose-600" },
  };
  const c = colorMap[color];

  return (
    <Card
      className="shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in border-0 bg-card"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
            <p className="text-2xl font-bold font-numeric text-foreground leading-none">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
            {trend && (
              <div className={cn(
                "flex items-center gap-1 mt-2 text-xs font-semibold",
                trend.value >= 0 ? "text-emerald-600" : "text-red-500"
              )}>
                {trend.value >= 0
                  ? <ArrowUpRight className="w-3 h-3" />
                  : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(trend.value).toFixed(1)}% {trend.label}
              </div>
            )}
          </div>
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", c.bg)}>
            <Icon className={cn("w-5 h-5", c.text)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LowStockAlert({ items }: { items: any[] }) {
  const utils = trpc.useUtils();
  const notifyMutation = trpc.notifications.checkLowStock.useMutation({
    onSuccess: (data) => {
      if (data.sent) {
        toast.success(`Notificación enviada — ${data.count} producto${data.count !== 1 ? "s" : ""} con stock bajo`);
      } else {
        toast.info(data.message || "Sin productos con stock bajo");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  if (!items.length) return null;
  return (
    <Card className="shadow-card border-amber-200 bg-amber-50/50 animate-fade-in" style={{ animationDelay: "200ms" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-amber-700 text-sm">
            <AlertTriangle className="w-4 h-4" />
            Alertas de stock bajo ({items.length})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => notifyMutation.mutate()}
            disabled={notifyMutation.isPending}
          >
            <Bell className="w-3 h-3" />
            {notifyMutation.isPending ? "Enviando..." : "Notificarme"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-amber-200/60">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
              </div>
              <Badge variant="destructive" className="text-xs ml-2 flex-shrink-0">
                {p.stock} uds
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground mb-1.5">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {formatter ? formatter(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { format } = useCurrency();

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: salesChart = [], isLoading: chartLoading } = trpc.dashboard.salesChart.useQuery({ days: 30 });
  const { data: topProducts = [] } = trpc.dashboard.topProducts.useQuery({ limit: 5 });
  const { data: balance } = trpc.dashboard.balance.useQuery();
  const { data: allProducts = [] } = trpc.products.list.useQuery({});

  // Build inventory by category chart data
  const inventoryByCategory = (() => {
    const map: Record<string, { stock: number; value: number }> = {};
    for (const p of allProducts as any[]) {
      const cat = p.category || "Sin categoría";
      if (!map[cat]) map[cat] = { stock: 0, value: 0 };
      map[cat].stock += p.stock;
      map[cat].value += parseFloat(p.costPrice) * p.stock;
    }
    return Object.entries(map).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.stock - a.stock).slice(0, 6);
  })();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">
          {greeting()}, {user?.name?.split(" ")[0] || "Usuario"} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aquí tienes el resumen de tu inventario
        </p>
      </div>

      {/* Low Stock Alert */}
      {stats?.lowStockItems && stats.lowStockItems.length > 0 && (
        <LowStockAlert items={stats.lowStockItems} />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard
          title="Productos activos"
          value={statsLoading ? "—" : String(stats?.totalProducts ?? 0)}
          subtitle="En catálogo"
          icon={Package}
          color="primary"
          delay={0}
        />
        <StatCard
          title="Valor del inventario"
          value={statsLoading ? "—" : format(stats?.totalInventoryValue ?? 0)}
          subtitle="A precio de costo"
          icon={Boxes}
          color="success"
          delay={60}
        />
        <StatCard
          title="Ingresos del mes"
          value={statsLoading ? "—" : format(stats?.monthlyRevenue ?? 0)}
          subtitle="Ventas registradas"
          icon={DollarSign}
          color="primary"
          delay={120}
        />
        <StatCard
          title="Ganancia estimada"
          value={statsLoading ? "—" : format(stats?.estimatedProfit ?? 0)}
          subtitle="Valor venta − costo"
          icon={TrendingUp}
          color={(stats?.estimatedProfit ?? 0) >= 0 ? "success" : "danger"}
          delay={180}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <Card className="lg:col-span-2 shadow-card animate-fade-in" style={{ animationDelay: "240ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Ventas — últimos 30 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading || salesChart.length === 0 ? (
              <div className="h-52 flex items-center justify-center">
                {chartLoading ? (
                  <div className="w-full h-full rounded-lg animate-shimmer" />
                ) : (
                  <div className="text-center">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Sin datos de ventas aún</p>
                  </div>
                )}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={salesChart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.42 0.18 264)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="oklch(0.42 0.18 264)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 247)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "oklch(0.52 0.015 247)" }}
                    tickFormatter={(v) => {
                      const d = new Date(v + "T00:00:00");
                      return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "oklch(0.52 0.015 247)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => format(v)} />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Ingresos"
                    stroke="oklch(0.42 0.18 264)"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="shadow-card animate-fade-in" style={{ animationDelay: "300ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Top productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="h-52 flex items-center justify-center">
                <div className="text-center">
                  <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Sin ventas aún</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p: any, i: number) => {
                  const maxRevenue = topProducts[0]?.totalRevenue || 1;
                  const pct = (p.totalRevenue / maxRevenue) * 100;
                  return (
                    <div key={p.productId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground truncate max-w-28">{p.productName}</span>
                        <span className="font-semibold font-numeric text-muted-foreground">{format(p.totalRevenue)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory by Category Chart */}
      {inventoryByCategory.length > 0 && (
        <Card className="shadow-card animate-fade-in" style={{ animationDelay: "360ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Stock por categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={inventoryByCategory} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 247)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "oklch(0.52 0.015 247)" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "oklch(0.52 0.015 247)" }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  formatter={(v: number) => [v, "Unidades"]}
                />
                <Bar dataKey="stock" name="Stock" radius={[4, 4, 0, 0]}>
                  {inventoryByCategory.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Balance Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Ingresos totales", value: balance?.totalRevenue ?? 0, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-100" },
          { label: "Costos totales", value: (balance?.totalCogs ?? 0) + (balance?.totalShipping ?? 0), icon: Truck, color: "text-red-500", bg: "bg-red-100" },
          { label: "Beneficio neto", value: balance?.netProfit ?? 0, icon: TrendingUp, color: (balance?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-red-500", bg: (balance?.netProfit ?? 0) >= 0 ? "bg-emerald-100" : "bg-red-100" },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <Card key={i} className="shadow-card animate-fade-in" style={{ animationDelay: `${360 + i * 60}ms` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", item.bg)}>
                    <Icon className={cn("w-4 h-4", item.color)} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={cn("text-lg font-bold font-numeric", item.color)}>
                      {format(item.value)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
