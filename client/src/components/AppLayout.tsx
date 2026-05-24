import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Box,
  ChevronRight,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import { useState } from "react";
import NotificationBell from "./NotificationBell";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { trpc } from "@/lib/trpc";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/shipments", label: "Envíos", icon: Truck },
  { href: "/movements", label: "Ventas & Movimientos", icon: ShoppingCart },
  { href: "/balance", label: "Balance", icon: TrendingUp },
  { href: "/activity", label: "Actividad", icon: Activity },
  { href: "/settings", label: "Configuración", icon: Settings },
];

function Sidebar({ collapsed, onClose }: { collapsed?: boolean; onClose?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { displayCurrency, setDisplayCurrency } = useCurrency();

  return (
    <aside
      className={cn(
        "flex flex-col h-full",
        "bg-sidebar text-sidebar-foreground"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg">
            <Box className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="font-display font-bold text-sm text-white leading-none">InventarioApp</p>
              <p className="text-xs text-sidebar-foreground/50 mt-0.5">Gestión compartida</p>
            </div>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Currency Toggle */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-1 bg-sidebar-accent rounded-lg p-1">
          <button
            onClick={() => setDisplayCurrency("USD")}
            className={cn(
              "flex-1 text-xs font-semibold py-1.5 rounded-md transition-all duration-200",
              displayCurrency === "USD"
                ? "bg-white text-sidebar shadow-sm"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
            )}
          >
            USD
          </button>
          <button
            onClick={() => setDisplayCurrency("CUP")}
            className={cn(
              "flex-1 text-xs font-semibold py-1.5 rounded-md transition-all duration-200",
              displayCurrency === "CUP"
                ? "bg-white text-sidebar shadow-sm"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
            )}
          >
            CUP
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-sidebar-foreground/30 uppercase tracking-wider px-3 mb-3">
          Menú
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <a
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                  isActive
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80")} />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-sidebar-primary" />}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        {user ? (
          <div className="flex items-center gap-1">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent/60 transition-colors group min-w-0">
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className="bg-indigo-500 text-white text-xs font-bold">
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate">
                    {user.name || user.email || "Usuario"}
                  </p>
                  <p className="text-xs text-sidebar-foreground/40 capitalize">{user.role}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
            <NotificationBell />
          </div>
        ) : (
          <a href="/login">
            <Button size="sm" className="w-full">Iniciar sesión</Button>
          </a>
        )}
      </div>
    </aside>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
            <Box className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to local login page
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
            <Box className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-muted-foreground">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-60 lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 z-10">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Box className="w-3 h-3 text-white" />
            </div>
            <span className="font-display font-bold text-sm">InventarioApp</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
