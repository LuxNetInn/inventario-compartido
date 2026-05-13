import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Settings as SettingsIcon, DollarSign, AlertTriangle, Users,
  Copy, Check, RefreshCw, Link, Shield, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

function SettingSection({ title, description, icon: Icon, children }: {
  title: string; description: string; icon: any; children: React.ReactNode;
}) {
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StockNotificationButton() {
  const notifyMutation = trpc.notifications.checkLowStock.useMutation({
    onSuccess: (data) => {
      if (data.sent) {
        toast.success(`Notificación enviada — ${data.count} producto${data.count !== 1 ? "s" : ""} con stock bajo`);
      } else {
        toast.info(data.message || "No hay productos con stock bajo actualmente");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Al pulsar el botón, se verificará el stock de todos los productos y se enviará una notificación
        a través de Manus si hay productos por debajo del umbral configurado.
      </p>
      <Button
        onClick={() => notifyMutation.mutate()}
        disabled={notifyMutation.isPending}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Bell className="w-3.5 h-3.5" />
        {notifyMutation.isPending ? "Verificando..." : "Verificar y notificar ahora"}
      </Button>
      {notifyMutation.data && (
        <p className="text-xs text-muted-foreground">
          {notifyMutation.data.sent
            ? `✅ Notificación enviada: ${notifyMutation.data.count} producto${notifyMutation.data.count !== 1 ? "s" : ""} con stock bajo`
            : `✔ Todo en orden: sin productos con stock bajo`}
        </p>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { exchangeRate } = useCurrency();
  const utils = trpc.useUtils();

  const [rateInput, setRateInput] = useState(String(exchangeRate));
  const [thresholdInput, setThresholdInput] = useState("5");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: allSettings } = trpc.settings.getAll.useQuery();
  const { data: activeInvites = [] } = trpc.invitations.listActive.useQuery();
  const { data: users = [] } = trpc.users.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  useEffect(() => {
    if (allSettings) {
      const rate = allSettings.find((s) => s.key === "exchangeRate");
      const threshold = allSettings.find((s) => s.key === "lowStockDefault");
      if (rate) setRateInput(rate.value);
      if (threshold) setThresholdInput(threshold.value);
    }
  }, [allSettings]);

  const setSettingMutation = trpc.settings.set.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      utils.settings.get.invalidate();
      toast.success("Configuración guardada");
    },
    onError: (e) => toast.error(e.message),
  });

  const createInviteMutation = trpc.invitations.create.useMutation({
    onSuccess: (data) => {
      setInviteUrl(data.inviteUrl);
      utils.invitations.listActive.invalidate();
      toast.success("Enlace de invitación generado");
    },
    onError: (e) => toast.error(e.message),
  });

  const saveRate = () => {
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate <= 0) return toast.error("Tasa inválida");
    setSettingMutation.mutate({ key: "exchangeRate", value: String(rate) });
  };

  const saveThreshold = () => {
    const t = parseInt(thresholdInput);
    if (isNaN(t) || t < 0) return toast.error("Umbral inválido");
    setSettingMutation.mutate({ key: "lowStockDefault", value: String(t) });
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Enlace copiado");
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ajusta las preferencias de tu inventario
        </p>
      </div>

      {/* Exchange Rate */}
      <SettingSection
        title="Tasa de cambio USD / CUP"
        description="Define cuántos pesos cubanos equivalen a 1 dólar estadounidense"
        icon={DollarSign}
      >
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              1 USD = ? CUP
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">1 USD =</span>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="w-32"
                placeholder="240"
              />
              <span className="text-sm font-semibold text-muted-foreground">CUP</span>
            </div>
          </div>
          <Button onClick={saveRate} disabled={setSettingMutation.isPending} size="sm">
            Guardar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Tasa actual: <strong>1 USD = {exchangeRate} CUP</strong>. Esta tasa se aplica a todas las conversiones de moneda en la app.
        </p>
      </SettingSection>

      {/* Low Stock Threshold */}
      <SettingSection
        title="Umbral de stock bajo"
        description="Cantidad mínima de stock antes de mostrar una alerta en el dashboard"
        icon={AlertTriangle}
      >
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              Alerta cuando el stock sea ≤
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-24"
                placeholder="5"
              />
              <span className="text-sm text-muted-foreground">unidades</span>
            </div>
          </div>
          <Button onClick={saveThreshold} disabled={setSettingMutation.isPending} size="sm">
            Guardar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Este umbral aplica por defecto a nuevos productos. Puedes ajustarlo individualmente en cada producto.
        </p>
      </SettingSection>

      {/* Stock Notifications */}
      <SettingSection
        title="Notificaciones de stock bajo"
        description="Recibe una notificación en Manus cuando algún producto baje del umbral configurado"
        icon={Bell}
      >
        <StockNotificationButton />
      </SettingSection>

      {/* Collaborator Invitation */}
      {user?.role === "admin" && (
        <SettingSection
          title="Invitar colaborador"
          description="Genera un enlace de invitación para que tu hermana acceda a la app"
          icon={Users}
        >
          <div className="space-y-4">
            {/* Current Users */}
            {users.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuarios activos</p>
                {users.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {(u.name || u.email || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{u.name || u.email || "Usuario"}</p>
                        {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
                      </div>
                    </div>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs capitalize">
                      {u.role === "admin" ? "Admin" : "Colaborador"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Generate Invite */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Generar enlace de invitación</p>
              <p className="text-xs text-muted-foreground">
                El enlace es válido por 7 días y puede usarse una sola vez.
              </p>
              <Button
                onClick={() => createInviteMutation.mutate({ origin: window.location.origin })}
                disabled={createInviteMutation.isPending}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Link className="w-3.5 h-3.5" />
                {createInviteMutation.isPending ? "Generando..." : "Generar enlace"}
              </Button>

              {inviteUrl && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border">
                  <p className="text-xs font-mono text-muted-foreground flex-1 truncate">{inviteUrl}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 flex-shrink-0"
                    onClick={() => handleCopy(inviteUrl)}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              )}
            </div>

            {/* Active Invites */}
            {activeInvites.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invitaciones pendientes</p>
                {activeInvites.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-xs">
                    <span className="text-muted-foreground font-mono truncate max-w-48">
                      {window.location.origin}/invite/{inv.token}
                    </span>
                    <span className="text-muted-foreground flex-shrink-0 ml-2">
                      Expira: {new Date(inv.expiresAt).toLocaleDateString("es")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingSection>
      )}

      {/* Account Info */}
      <SettingSection
        title="Información de cuenta"
        description="Datos de tu sesión actual"
        icon={Shield}
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">Nombre</span>
            <span className="font-medium">{user?.name || "—"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email || "—"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Rol</span>
            <Badge variant={user?.role === "admin" ? "default" : "secondary"} className="text-xs capitalize">
              {user?.role === "admin" ? "Administrador" : "Colaborador"}
            </Badge>
          </div>
        </div>
      </SettingSection>
    </div>
  );
}
