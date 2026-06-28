import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { API_BASE } from "@/lib/api";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Settings as SettingsIcon, DollarSign, AlertTriangle, Users,
  Copy, Check, RefreshCw, Link, Shield, Bell, UserPlus, Trash2, KeyRound, Eye, EyeOff, Loader2
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

function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return toast.error("Completa todos los campos");
    if (password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email: email.trim().toLowerCase(), password, role: "user" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al crear usuario"); return; }
      toast.success(`Cuenta creada para ${name}`);
      setName(""); setEmail(""); setPassword("");
      onSuccess();
    } catch { toast.error("Error de conexión"); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nombre</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo" className="h-9 text-sm" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com" className="h-9 text-sm" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Contraseña</Label>
        <div className="relative">
          <Input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="h-9 text-sm pr-9"
            required
          />
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <Button type="submit" disabled={loading} size="sm" className="gap-2">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
        {loading ? "Creando..." : "Crear cuenta"}
      </Button>
    </form>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !next) return toast.error("Completa ambos campos");
    if (next.length < 6) return toast.error("La nueva contraseña debe tener al menos 6 caracteres");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al cambiar contraseña"); return; }
      toast.success("Contraseña actualizada correctamente");
      setCurrent(""); setNext("");
    } catch { toast.error("Error de conexión"); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleChange} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Contraseña actual</Label>
        <div className="relative">
          <Input type={showCurrent ? "text" : "password"} value={current}
            onChange={e => setCurrent(e.target.value)} placeholder="Tu contraseña actual"
            className="h-9 text-sm pr-9" required />
          <button type="button" onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Nueva contraseña</Label>
        <div className="relative">
          <Input type={showNext ? "text" : "password"} value={next}
            onChange={e => setNext(e.target.value)} placeholder="Mínimo 6 caracteres"
            className="h-9 text-sm pr-9" required />
          <button type="button" onClick={() => setShowNext(!showNext)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showNext ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <Button type="submit" disabled={loading} size="sm" className="gap-2">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
        {loading ? "Guardando..." : "Cambiar contraseña"}
      </Button>
    </form>
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

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`¿Eliminar la cuenta de "${userName}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/delete-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al eliminar usuario"); return; }
      toast.success("Usuario eliminado");
      utils.users.list.invalidate();
    } catch { toast.error("Error de conexión"); }
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
                    <div className="flex items-center gap-2">
                      <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs capitalize">
                        {u.role === "admin" ? "Admin" : "Colaborador"}
                      </Badge>
                      {u.role !== "admin" && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name || u.email)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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

      {/* Create Collaborator (Admin only) */}
      {user?.role === "admin" && (
        <SettingSection
          title="Crear cuenta de colaborador"
          description="Crea una cuenta con email y contraseña para que tu hermana acceda sin VPN"
          icon={UserPlus}
        >
          <CreateUserForm onSuccess={() => utils.users.list.invalidate()} />
        </SettingSection>
      )}

      {/* Change Password */}
      <SettingSection
        title="Cambiar contraseña"
        description="Actualiza tu contraseña de acceso"
        icon={KeyRound}
      >
        <ChangePasswordForm />
      </SettingSection>

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
