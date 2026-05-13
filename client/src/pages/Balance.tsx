import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToExcel } from "@/lib/export";
import { TrendingUp, TrendingDown, DollarSign, Truck, Package, BarChart3, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

const COLORS = [
  "oklch(0.42 0.18 264)",
  "oklch(0.55 0.22 27)",
  "oklch(0.72 0.18 55)",
  "oklch(0.62 0.17 162)",
];

// ─── Date Range Presets ───────────────────────────────────────────────────────
type DatePreset = "week" | "month" | "quarter" | "year" | "all";

const presets: { key: DatePreset; label: string }[] = [
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Este año" },
  { key: "all", label: "Todo" },
];

function getDateRange(preset: DatePreset): { from?: Date; to?: Date } {
  const now = new Date();
  if (preset === "all") return {};
  if (preset === "week") {
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    return { from, to: now };
  }
  if (preset === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to: now };
  }
  if (preset === "quarter") {
    const from = new Date(now);
    from.setMonth(now.getMonth() - 3);
    return { from, to: now };
  }
  if (preset === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from, to: now };
  }
  return {};
}

// ─── Balance Row ──────────────────────────────────────────────────────────────
function BalanceRow({ label, value, sub, positive, bold }: {
  label: string; value: string; sub?: string; positive?: boolean; bold?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between py-3 border-b border-border/50 last:border-0", bold && "font-bold")}>
      <div>
        <p className={cn("text-sm", bold ? "font-bold text-foreground" : "text-muted-foreground")}>{label}</p>
        {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
      <span className={cn(
        "font-numeric text-sm",
        bold ? "text-base font-bold" : "",
        positive === true ? "text-emerald-600" : positive === false ? "text-red-500" : "text-foreground"
      )}>
        {value}
      </span>
    </div>
  );
}

export default function Balance() {
  const { format } = useCurrency();
  const [activePreset, setActivePreset] = useState<DatePreset>("month");

  const dateRange = useMemo(() => getDateRange(activePreset), [activePreset]);

  const { data: balance, isLoading } = trpc.dashboard.balance.useQuery(
    dateRange.from || dateRange.to
      ? { from: dateRange.from, to: dateRange.to }
      : undefined
  );
  const { data: topProducts = [] } = trpc.dashboard.topProducts.useQuery({ limit: 8 });

  const pieData = balance ? [
    { name: "Costo de productos", value: balance.totalCogs },
    { name: "Costos de envío", value: balance.totalShipping },
    { name: "Beneficio neto", value: Math.max(0, balance.netProfit) },
  ].filter(d => d.value > 0) : [];

  const marginPct = balance && balance.totalRevenue > 0
    ? ((balance.netProfit / balance.totalRevenue) * 100).toFixed(1)
    : "0";

  // Export data
  const handleExportCSV = () => {
    const data = [
      { Concepto: "Ingresos totales", Valor: balance?.totalRevenue ?? 0 },
      { Concepto: "Costo de productos (COGS)", Valor: balance?.totalCogs ?? 0 },
      { Concepto: "Costos de envío", Valor: balance?.totalShipping ?? 0 },
      { Concepto: "Beneficio bruto", Valor: balance?.grossProfit ?? 0 },
      { Concepto: "Beneficio neto", Valor: balance?.netProfit ?? 0 },
      { Concepto: "Margen neto (%)", Valor: marginPct },
    ];
    exportToCSV(data, `balance-${activePreset}`);
  };

  const handleExportExcel = () => {
    const summaryData = [
      { Concepto: "Ingresos totales", Valor: balance?.totalRevenue ?? 0 },
      { Concepto: "Costo de productos (COGS)", Valor: balance?.totalCogs ?? 0 },
      { Concepto: "Costos de envío", Valor: balance?.totalShipping ?? 0 },
      { Concepto: "Beneficio bruto", Valor: balance?.grossProfit ?? 0 },
      { Concepto: "Beneficio neto", Valor: balance?.netProfit ?? 0 },
      { Concepto: "Margen neto (%)", Valor: marginPct },
    ];
    const topData = topProducts.map((p: any) => ({
      Producto: p.productName,
      "Cantidad vendida": p.totalQty,
      "Ingresos": p.totalRevenue,
    }));
    exportToExcel([
      { name: "Balance", data: summaryData },
      { name: "Top Productos", data: topData },
    ], `balance-${activePreset}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Balance financiero</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Resumen completo de ingresos, costos y beneficios
          </p>
        </div>
        <ExportMenu
          disabled={!balance || balance.totalRevenue === 0}
          onExportCSV={handleExportCSV}
          onExportExcel={handleExportExcel}
          label="Exportar balance"
        />
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-2 flex-wrap animate-fade-in" style={{ animationDelay: "60ms" }}>
        <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex gap-1.5 flex-wrap">
          {presets.map((p) => (
            <Button
              key={p.key}
              variant={activePreset === p.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActivePreset(p.key)}
              className="text-xs h-7 px-3"
            >
              {p.label}
            </Button>
          ))}
        </div>
        {activePreset !== "all" && dateRange.from && (
          <span className="text-xs text-muted-foreground ml-1">
            {dateRange.from.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
            {" — "}
            {(dateRange.to || new Date()).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {[
          {
            label: "Ingresos totales", value: format(balance?.totalRevenue ?? 0),
            icon: DollarSign, color: "bg-emerald-100", text: "text-emerald-600",
            sub: "Todas las ventas"
          },
          {
            label: "Costo de productos", value: format(balance?.totalCogs ?? 0),
            icon: Package, color: "bg-blue-100", text: "text-blue-600",
            sub: "COGS estimado"
          },
          {
            label: "Costos de envío", value: format(balance?.totalShipping ?? 0),
            icon: Truck, color: "bg-amber-100", text: "text-amber-600",
            sub: "Total envíos"
          },
          {
            label: "Beneficio neto", value: format(balance?.netProfit ?? 0),
            icon: TrendingUp, color: (balance?.netProfit ?? 0) >= 0 ? "bg-emerald-100" : "bg-red-100",
            text: (balance?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-red-500",
            sub: `Margen: ${marginPct}%`
          },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <Card key={i} className="shadow-card animate-fade-in border-0" style={{ animationDelay: `${120 + i * 60}ms` }}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-xl font-bold font-numeric mt-1.5">{isLoading ? "—" : item.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
                  </div>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.color)}>
                    <Icon className={cn("w-5 h-5", item.text)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown Pie */}
        <Card className="shadow-card animate-fade-in" style={{ animationDelay: "360ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribución de costos e ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-56 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Sin datos para el período seleccionado</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => format(v)}
                    contentStyle={{
                      background: "white",
                      border: "1px solid oklch(0.9 0.005 247)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span style={{ fontSize: 11, color: "oklch(0.52 0.015 247)" }}>{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Product */}
        <Card className="shadow-card animate-fade-in" style={{ animationDelay: "420ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Ingresos por producto</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="h-56 flex items-center justify-center">
                <div className="text-center">
                  <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Sin ventas registradas</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={topProducts.map((p: any) => ({
                    name: p.productName.length > 12 ? p.productName.slice(0, 12) + "…" : p.productName,
                    revenue: p.totalRevenue,
                    qty: p.totalQty,
                  }))}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 247)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "oklch(0.52 0.015 247)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 10, fill: "oklch(0.52 0.015 247)" }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    formatter={(v: number) => format(v)}
                    contentStyle={{
                      background: "white",
                      border: "1px solid oklch(0.9 0.005 247)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="revenue" name="Ingresos" fill="oklch(0.42 0.18 264)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Balance Table */}
      <Card className="shadow-card animate-fade-in" style={{ animationDelay: "480ms" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Desglose financiero —{" "}
            <span className="text-muted-foreground font-normal">
              {presets.find(p => p.key === activePreset)?.label}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <BalanceRow
              label="Ingresos por ventas"
              value={format(balance?.totalRevenue ?? 0)}
              sub="Suma de todas las ventas registradas"
              positive={true}
            />
            <BalanceRow
              label="Costo de productos vendidos"
              value={`-${format(balance?.totalCogs ?? 0)}`}
              sub="Precio de costo × cantidad vendida"
              positive={false}
            />
            <BalanceRow
              label="Beneficio bruto"
              value={format(balance?.grossProfit ?? 0)}
              positive={(balance?.grossProfit ?? 0) >= 0}
            />
            <BalanceRow
              label="Costos de envío"
              value={`-${format(balance?.totalShipping ?? 0)}`}
              sub="Total de envíos en ventas"
              positive={false}
            />
            <BalanceRow
              label="Beneficio neto"
              value={format(balance?.netProfit ?? 0)}
              sub={`Margen neto: ${marginPct}%`}
              positive={(balance?.netProfit ?? 0) >= 0}
              bold
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
