import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Box, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();

  const { data: validation, isLoading: validating } = trpc.invitations.validate.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  const acceptMutation = trpc.invitations.accept.useMutation({
    onSuccess: () => {
      toast.success("¡Invitación aceptada! Bienvenida a InventarioApp");
      setTimeout(() => navigate("/"), 1500);
    },
    onError: (e) => toast.error(e.message),
  });

  if (loading || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando invitación...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (!validation?.valid) {
      const messages = {
        not_found: { title: "Invitación no encontrada", desc: "Este enlace no existe o ya fue eliminado." },
        already_used: { title: "Invitación ya utilizada", desc: "Este enlace ya fue usado. Solicita uno nuevo al administrador." },
        expired: { title: "Invitación expirada", desc: "Este enlace ha expirado. Solicita uno nuevo al administrador." },
      };
      const msg = messages[validation?.reason as keyof typeof messages] || messages.not_found;
      return (
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{msg.title}</h2>
          <p className="text-sm text-muted-foreground mb-6">{msg.desc}</p>
          <Button variant="outline" onClick={() => navigate("/")}>Ir al inicio</Button>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">¡Invitación válida!</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Inicia sesión con tu cuenta de Manus para aceptar la invitación y acceder al inventario compartido.
          </p>
          <a href={getLoginUrl()}>
            <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
              Iniciar sesión para continuar
            </Button>
          </a>
        </div>
      );
    }

    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">¡Bienvenida!</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Hola, <strong>{user?.name || user?.email}</strong>. Has sido invitada a colaborar en InventarioApp.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Tendrás acceso completo para gestionar productos, registrar ventas y ver estadísticas.
        </p>
        <Button
          className="w-full"
          onClick={() => acceptMutation.mutate({ token: token || "" })}
          disabled={acceptMutation.isPending}
        >
          {acceptMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aceptando...</>
          ) : "Aceptar invitación"}
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-3 shadow-xl">
            <Box className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground">InventarioApp</h1>
          <p className="text-sm text-muted-foreground">Gestión de inventario compartida</p>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-6">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
