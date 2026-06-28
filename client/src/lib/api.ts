// En desarrollo: rutas relativas ("/api/...") — el server Vite las maneja
// En producción (Cloudflare Pages): URL completa del backend en Render
export const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api\/trpc$/, "") || "";
