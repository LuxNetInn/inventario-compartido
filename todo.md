# InventarioApp — TODO

## Base de datos y backend
- [x] Esquema: tabla `products` (name, category, costPrice, salePrice, stock, supplier, notes, currency, lowStockThreshold)
- [x] Esquema: tabla `price_history` (productId, oldPrice, newPrice, changedBy, changedAt, type: cost|sale)
- [x] Esquema: tabla `movements` (productId, type: sale|restock|adjustment, quantity, unitPrice, shippingCost, currency, notes, createdBy, createdAt)
- [x] Esquema: tabla `settings` (key, value) — para tasa de cambio USD/CUP y configuración global
- [x] Esquema: tabla `invitations` (token, email, usedAt) — para invitar al colaborador
- [x] Migración SQL ejecutada en DB
- [x] Helpers de DB en server/db.ts para todos los modelos
- [x] Router tRPC: products (CRUD + price update + price history)
- [x] Router tRPC: movements (crear, listar, filtrar)
- [x] Router tRPC: dashboard (stats, charts data, balance)
- [x] Router tRPC: settings (get/set exchange rate, low stock threshold)
- [x] Router tRPC: invitations (crear invitación, aceptar invitación)

## Frontend — Layout y diseño
- [x] Sistema de colores elegante en index.css (paleta premium, tipografía refinada)
- [x] DashboardLayout con sidebar navigation
- [x] Sidebar con links: Dashboard, Productos, Ventas/Movimientos, Balance, Configuración
- [x] Header con usuario actual, moneda activa y toggle USD/CUP
- [x] Diseño responsive (móvil, tablet, desktop)

## Frontend — Páginas
- [x] Dashboard principal: KPIs, alertas de stock bajo, gráficas
- [x] Página de Productos: tabla con búsqueda, filtros, CRUD modal
- [x] Modal de producto: formulario completo con todos los campos
- [x] Historial de precios por producto (drawer/modal)
- [x] Página de Ventas/Movimientos: tabla con filtros, registrar venta/restock/ajuste
- [x] Modal de movimiento: formulario con costo de envío
- [x] Página de Balance: resumen financiero detallado
- [x] Página de Configuración: tasa de cambio, umbral de stock bajo, gestión de colaborador

## Frontend — Gráficas (recharts)
- [x] Gráfica de ventas en el tiempo (línea)
- [x] Gráfica de niveles de inventario por categoría (barras)
- [x] Gráfica de evolución de precios por producto (línea)
- [x] Gráfica de productos más vendidos (barras horizontales)
- [x] Gráfica de distribución de costos (dona)

## Multi-moneda
- [x] Configuración de tasa de cambio USD→CUP manual
- [x] Mostrar precios en USD o CUP según preferencia
- [x] Conversión en balance y estadísticas

## Autenticación y colaboración
- [x] Owner automáticamente es admin al registrarse
- [x] Sistema de invitación por token para el colaborador
- [x] Página de invitación (/invite/:token)

## Tests
- [x] Tests de routers principales (products, movements, settings)

## Nuevas funcionalidades (v1.1)
- [x] Exportación CSV de productos (botón en página Productos)
- [x] Exportación CSV de movimientos (botón en página Ventas & Movimientos)
- [x] Exportación Excel (.xlsx) de productos y movimientos
- [x] Filtros de fecha en Balance (selector: semana, mes, trimestre, año, todo)
- [x] Backend: endpoint de balance con rango de fechas
- [x] Notificaciones de stock bajo (alerta al owner vía Manus cuando producto baja del umbral)
- [x] Backend: procedimiento tRPC para enviar notificación de stock bajo
- [x] Tests actualizados para las nuevas funcionalidades (21 tests pasando)

## Sistema de autenticación propio (v1.2)
- [x] Agregar campo passwordHash a tabla users en schema
- [x] Migrar DB con el nuevo campo
- [x] Endpoint de registro (solo admin puede crear usuarios)
- [x] Endpoint de login con email + contraseña (devuelve JWT en cookie)
- [x] Endpoint de logout propio
- [x] Endpoint de cambio de contraseña
- [x] Página de login con formulario email/contraseña
- [x] Panel de gestión de usuarios en Configuración (crear/eliminar colaborador)
- [x] Eliminar dependencia del OAuth de Manus en el frontend
- [x] Tests actualizados para el nuevo sistema de auth (25 tests pasando)

## Sistema de seguimiento de envíos (v1.3)
- [x] Esquema DB: tabla `shipments` (id, title, notes, status, shippingCost, createdBy, sentAt, receivedAt, createdAt)
- [x] Esquema DB: tabla `shipment_items` (id, shipmentId, productId, quantity, unitCost, notes)
- [x] Migración SQL aplicada
- [x] Router tRPC: crear envío con items (estado inicial: pending)
- [x] Router tRPC: listar envíos con items y productos
- [x] Router tRPC: confirmar envío (admin → estado: in_transit)
- [x] Router tRPC: confirmar recepción (colaborador → estado: delivered, activa stock en productos)
- [x] Router tRPC: cancelar envío
- [x] Página de Envíos con lista de envíos por estado
- [x] Modal para crear envío: título, notas, costo de envío, agregar productos con cantidad y costo
- [x] Tarjetas de envío con estado visual (badge de color), items y acciones según rol
- [x] Botón "Marcar como enviado" (solo admin/owner)
- [x] Botón "Confirmar recepción" (solo colaborador)
- [x] Al confirmar recepción: sumar stock a los productos correspondientes automáticamente
- [x] Widget en Dashboard: envíos en tránsito y pendientes
- [x] Enlace de Envíos en sidebar de navegación
- [x] Notificación al colaborador cuando se marca un envío como "en tránsito"
- [x] Tests actualizados para el sistema de envíos (28 tests pasando)

## Mejoras UX (v1.4)
- [x] Alertas de stock bajo descartables: botón X para cerrar cada alerta individualmente
- [x] Persistir alertas cerradas en localStorage (clave: productId + stock actual)
- [x] Alerta reaparece solo si el stock cambia (sube y vuelve a bajar del umbral)
