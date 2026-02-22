# Resumen del Proyecto: TraeGo - Catálogo SaaS

## Descripción
**TraeGo** es una plataforma SaaS (Software as a Service) diseñada para potenciar pequeños y medianos negocios gastronómicos mediante la creación instantánea de catálogos digitales. Su enfoque principal es simplificar la gestión de pedidos redirigiendo el flujo de venta directamente a WhatsApp, eliminando intermediarios y comisiones por transacción.

## Stack Tecnológico

El proyecto está construido con un enfoque moderno y ligero, priorizando el rendimiento y la facilidad de mantenimiento:

- **Core**: 
  - **HTML5** & **CSS3** (Vanilla, con variables CSS para temas).
  - **JavaScript** (ES Modules, sin frameworks pesados como React o Vue, para máxima velocidad).
- **Build Tool**: [Vite](https://vitejs.dev/) - Para un entorno de desarrollo rápido y builds optimizados.
- **Backend / BaaS**: [Supabase](https://supabase.com/) - Manejo de autenticación, base de datos en tiempo real y almacenamiento.
- **Librerías Auxiliares**:
  - `gsap`: Para animaciones fluidas y micro-interacciones.
  - `echarts`: Para visualización de métricas y reportes en el dashboard.
  - `jspdf`: Generación de facturas y recibos en PDF directamente en el cliente.
  - `xlsx`: Importación y exportación de datos (ej. carga masiva de productos).
  - `dompurify` (Probable uso interno o recomendado): Sanitización de HTML.

## Funcionalidades Clave

### 🏢 Para el Negocio (Panel Administrativo)
1.  **Dashboard de Control**: Vista general de ventas, pedidos y métricas clave.
2.  **Gestión de Inventario**:
    - Creación y edición de productos con imágenes, precios y descripciones.
    - Manejo de variantes (tamaños, acompañantes) y "comentarios rápidos" (ej. "Sin cebolla").
    - Control de stock y disponibilidad.
3.  **Configuración de Negocio**:
    - Personalización de marca (Logo, colores, banner).
    - Definición de horarios de atención y zonas de cobertura.
    - Configuración de métodos de pago y costos de envío.
4.  **Gestión de Pedidos**:
    - Recepción de pedidos en tiempo real.
    - Cambio de estados (Pendiente, En preparación, Enviado, Entregado).
    - Asignación de repartidores (Gestión de flota propia).
5.  **Marketing & Fidelización**:
    - Creación de cupones de descuento y promociones.
    - Menús especiales por día.
6.  **Centro de Enlaces (Link Center)**:
    - Creación de páginas "Multilink" tipo Linktree totalmente personalizables.
    - Edición intuitiva de enlaces, apariencia (colores, fondos) e íconos sociales mediante modales.
    - Previsualización en tiempo real.

### 🛒 Para el Cliente Final (Catálogo Público)
1.  **Experiencia de Usuario Fluida**: Interfaz tipo "App" que funciona en el navegador sin descargas.
2.  **Carrito de Compras Dinámico**: Adición fácil de productos y cálculo automático de totales.
3.  **Checkout a WhatsApp**: Al finalizar el pedido, se genera un mensaje pre-formateado con todo el detalle para enviar al WhatsApp del negocio con un solo clic.
4.  **Búsqueda y Filtrado**: Encontrar productos por categorías o nombre rápidamente.
5.  **Páginas Multilink Personalizadas**: Acceso rápido al catálogo, WhatsApp y redes sociales del negocio desde un único enlace optimizado.
6.  **SEO y Compartibilidad**: Uso de metadatos Open Graph para previsualizaciones ricas (imágenes, títulos) al compartir enlaces en redes y WhatsApp.
7.  **Páginas de Error Amigables**: Experiencia unificada y consistente en escenarios de "Catálogo no encontrado" o "Error 404".

## Estructura del Proyecto
El código sigue una arquitectura modular dentro de `src/`:
- `pages/`: Contiene la lógica y estilos específicos de cada vista (Landing, Admin, Catalog, Auth).
- `services/`: Capa de comunicación con Supabase y lógica de negocio reutilizable.
- `components/`: Elementos UI reutilizables (Modales, Botones, Tarjetas).
- `utils/`: Funciones auxiliares (Formateo de moneda, validaciones).
