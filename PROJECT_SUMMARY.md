# Resumen del Proyecto: TraeGo - Catálogo SaaS

## Descripción
**TraeGo** es una plataforma SaaS (Software as a Service) diseñada para potenciar pequeños y medianos negocios gastronómicos mediante la creación instantánea de catálogos digitales. Su enfoque principal es simplificar la gestión de pedidos redirigiendo el flujo de venta directamente a WhatsApp, eliminando intermediarios y comisiones por transacción.

## Stack Tecnológico

El proyecto está construido con un enfoque moderno y ligero, priorizando el rendimiento y la facilidad de mantenimiento:

- **Core**:
  - **HTML5** & **CSS3** (Vanilla, con variables CSS para temas).
  - **JavaScript** (ES Modules, sin frameworks pesados como React o Vue, para máxima velocidad).
- **Build Tool**: [Vite](https://vitejs.dev/) - Para un entorno de desarrollo rápido y builds optimizados.
- **Backend / BaaS**: [Supabase](https://supabase.com/) - Autenticación, base de datos en tiempo real, almacenamiento y Row Level Security (RLS).
- **Deploy**: [Vercel](https://vercel.com/) con `vercel.json` para reescritura de rutas SPA.
- **Librerías Auxiliares**:
  - `gsap`: Para animaciones fluidas y micro-interacciones.
  - `echarts`: Visualización de métricas y reportes en el dashboard.
  - `jspdf`: Generación de facturas y recibos en PDF en el cliente.
  - `xlsx`: Importación y exportación de datos (carga masiva de productos).
  - `dompurify`: Sanitización de HTML para prevenir XSS.

## Funcionalidades Clave

### 🏢 Para el Negocio (Panel Administrativo)

1. **Dashboard de Control**: Vista general de pedidos, ventas y métricas clave con gráficos (ECharts).
2. **Gestión de Inventario**:
   - Creación y edición de productos con imágenes, precios y descripciones.
   - Manejo de variantes (tamaños, acompañantes) y "comentarios rápidos" (ej. "Sin cebolla").
   - Control de stock y disponibilidad.
3. **Configuración de Negocio**:
   - Personalización de marca (logo, colores, banner).
   - Horarios de atención y zonas de cobertura.
   - Métodos de pago y costos de envío.
4. **Gestión de Pedidos**:
   - Recepción de pedidos en tiempo real con badge de pedidos activos (actualización sin recarga).
   - Cambio de estados (Pendiente, En preparación, Enviado, Entregado).
   - Modal de detalles de pedido con vista completa de ítems, variantes y totales.
   - Asignación de repartidores (gestión de flota propia).
5. **Marketing & Fidelización**:
   - Cupones de descuento y promociones con modalidades configurables.
   - Menús especiales por día.
   - Sugerencias de productos en el checkout para aumentar el ticket promedio.
6. **Centro de Enlaces (Link Center)**:
   - Creación de páginas "Multilink" tipo Linktree totalmente personalizables.
   - Edición de enlaces, apariencia (colores, fondos, tipografía) e íconos sociales mediante modales.
   - Previsualización en tiempo real en el editor.
   - Contador de clics por enlace.
   - Soporte para ícono de categoría (Home siempre primero, fijo e indeleble).

### 🛒 Para el Cliente Final (Catálogo Público)

1. **Experiencia de Usuario Fluida**: Interfaz tipo "App" que funciona en el navegador sin descargas.
2. **Carrito de Compras Dinámico**: Adición fácil de productos y cálculo automático de totales.
3. **Checkout a WhatsApp**: Generación de mensaje pre-formateado con todo el detalle del pedido.
4. **Sugerencias en Checkout**: Productos recomendados antes de finalizar el pedido.
5. **Búsqueda y Filtrado**: Encontrar productos por categorías o nombre rápidamente.
6. **Páginas Multilink Personalizadas**: Acceso rápido al catálogo, WhatsApp y redes sociales desde un único enlace optimizado (`/l/{slug}`).
7. **SEO y Compartibilidad**: Metadatos Open Graph para previsualizaciones ricas al compartir en redes y WhatsApp.
8. **Páginas de Error Amigables**: Experiencia unificada en escenarios de "Catálogo no encontrado", "Links no encontrado" y "Error 404".

### 🌐 Landing Page Pública

- Sección de métricas globales en tiempo real (número de negocios, pedidos totales, etc.) obtenidas desde Supabase.
- Sección de precios con planes: **Gratis**, **Plus**, **Pro** y **Premium** (próximamente).
- Diseño responsive con animaciones GSAP.

## Seguridad

- **Row Level Security (RLS)** habilitado en todas las tablas sensibles de Supabase.
- Políticas de acceso para que cada negocio solo gestione sus propios datos.
- Protección en rutas del panel admin mediante `middleware.js` de Vercel.

## Estructura del Proyecto

```
src/
├── pages/          # Vistas principales (landing, admin, catalog, links, auth, dashboard, 404...)
│   ├── admin/      # Panel administrativo del negocio
│   ├── catalog/    # Catálogo público del cliente
│   ├── links/      # Editor y vista pública del Link Center
│   ├── dashboard/  # Métricas y reportes
│   └── landing/    # Landing page de TraeGo
├── services/       # Capa de comunicación con Supabase (por entidad)
├── components/     # Elementos UI reutilizables
├── utils/          # Funciones auxiliares (formateo, validaciones, helpers)
├── styles/         # Estilos globales y variables CSS
└── config/         # Configuración global (Supabase client, etc.)
```
