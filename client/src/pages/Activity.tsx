import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Search, Activity, ShoppingCart, Package, RefreshCw, SlidersHorizontal, Truck, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ENTITY_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  movement: { label: "Movimiento", color: "bg-emerald-100 text-emerald-700", icon: ShoppingCart },
  product: { label: "Producto", color: "bg-blue-100 text-blue-700", icon: Package },
  shipment: { label: "Envío", color: "bg-purple-100 text-purple-700", icon: Truck },
  settings: { label: "Config.", color: "bg-slate-100 text-slate-600", icon: Settings },
};

const ENTITY_FILTERS = [
  { value: "all", label: "Todo" },
  { value: "movement", label: "Movimientos" },
  { value: "product", label: "Productos" },
  { value: "shipment", label: "Envíos" },
];

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
  return new Date(date).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

function getAvatarColor(name?: string | null): string {
  if (!name) return AVATAR_COLORS[0];
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function ActivityPage() {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  const { data: logs = [], isLoading } = trpc.activity.list.useQuery({
    limit: 100,
    entityType: entityFilter !== "all" ? entityFilter : undefined,
  });

  const filtered = logs.filter((log: any) => {
    const matchSearch = !search ||
      (log.details || "").toLowerCase().includes(search.toLowerCase()) ||
      (log.userName || "").toLowerCase().includes(search.toLowerCase()) ||
      (log.action || "").toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historial de Actividad</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro de todas las acciones realizadas en el sistema
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Activity className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuario, acción o detalle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {ENTITY_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={entityFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setEntityFilter(f.value)}
              className="text-xs"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full animate-shimmer flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded animate-shimmer" />
                    <div className="h-3 w-2/3 rounded animate-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {search || entityFilter !== "all"
                  ? "Sin resultados para estos filtros"
                  : "No hay actividad registrada aún"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Las acciones como registrar ventas, crear productos o gestionar envíos aparecerán aquí
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map((log: any, idx: number) => {
                const entityCfg = ENTITY_CONFIG[log.entityType] || {
                  label: log.entityType,
                  color: "bg-slate-100 text-slate-600",
                  icon: Activity,
                };
                const EntityIcon = entityCfg.icon;
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5",
                      getAvatarColor(log.userName)
                    )}>
                      {getInitials(log.userName)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          {log.userName || "Sistema"}
                        </span>
                        <span className="text-sm text-muted-foreground">{log.action}</span>
                        <span className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                          entityCfg.color
                        )}>
                          <EntityIcon className="w-3 h-3" />
                          {entityCfg.label}
                        </span>
                      </div>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">
                          {log.details}
                        </p>
                      )}
                    </div>

                    {/* Time */}
                    <span className="text-xs text-muted-foreground/70 flex-shrink-0 whitespace-nowrap mt-0.5">
                      {timeAgo(log.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <p className="text-center text-xs text-muted-foreground/60">
          Mostrando {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
