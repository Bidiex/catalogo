# Implementación de Notificaciones y Announcement Modal

Este plan describe la implementación del sistema de anuncios y notificaciones para los propietarios (negocios), así como la interfaz para que los Super Admins gestionen dichos anuncios.

## User Review Required

> [!IMPORTANT]
> El prompt menciona "hermano del cart-panel" en `src/pages/dashboard/index.html`. Sin embargo, `cart-panel` no existe actualmente en el Dashboard (generalmente pertenece al catálogo). Propongo colocar el HTML del panel de notificaciones (`.notifications-panel`) como hermano del `.dashboard-content` o al final del `body`, y darle un comportamiento tipo "drawer" (panel lateral derecho) típico de los dashboards.

> [!IMPORTANT]
> Para la sección de administración, el prompt indica `src/admin/announcements.js (o .html según estructura del admin)`. La estructura actual del proyecto aloja el super-admin en `src/pages/admin/...`. Propongo crear `src/pages/admin/announcements/index.html` y su respectivo `.js`, además de agregar el enlace correspondiente en el sidebar de navegación (`src/pages/admin/dashboard/index.html` y los demás HTML de admin).

## Proposed Changes

### Componentes de Interfaz y Lógica

#### [NEW] src/components/AnnouncementModal.js
- Componente que se encargará de crear y renderizar el modal en el DOM dinámicamente.
- Recibirá los datos del anuncio (título, descripción, imagen, CTAs).
- Manejo de botones de cierre (X) invocando el RPC `mark_announcement_dismissed`.
- Manejo del CTA invocando `mark_announcement_read` y ejecutando la acción (`link`, `phone`, `whatsapp`).
- Al renderizarse invocará inmediatamente `mark_announcement_seen`.
- Se aplicará un ancho máximo de `420px` en desktop y `92vw` en mobile, y animación `fade + scale` con un backdrop levemente borroso.

#### [NEW] src/components/NotificationBell.js
- Componente encargado de renderizar la campanilla con el contador de notificaciones no leídas.
- Controlará la apertura y cierre del panel lateral de notificaciones (`.notifications-panel`).

### Dashboard

#### [MODIFY] src/pages/dashboard/index.html
- Se añadirá el botón/contenedor para el `NotificationBell` dentro de `.header-actions`.
- Se insertará la estructura base de `<div class="notifications-panel-overlay">` y `<aside class="notifications-panel">` antes de cerrar el `<div class="dashboard-container">`.

#### [MODIFY] src/pages/dashboard/dashboard.js
- Se inicializará la lógica para obtener notificaciones al cargar el dashboard (`get_my_announcements`).
- Se filtrarán los anuncios con `show_as_modal = true` y `seen_at` nulo.
- Se tomará el más reciente y se inicializará el `AnnouncementModal` con sus datos.
- Se instanciará el `NotificationBell`.

#### [MODIFY] src/pages/dashboard/dashboard.css
- Se agregarán los estilos correspondientes a `.notifications-panel` (drawer derecho), `.notifications-overlay` y los estilos específicos del Modal según los requerimientos visuales (imagen 1:1, CTA flotante, botón X exterior, etc).

### Super Admin

#### [NEW] src/pages/admin/announcements/index.html
- Estructura HTML base para el CRUD de anuncios globales (para enviar a los negocios), siguiendo el layout existente de las páginas en `/admin/`.

#### [NEW] src/pages/admin/announcements/announcements.js
- Lógica de la tabla y formulario para administrar la tabla de anuncios (presumo la tabla subyacente para `get_my_announcements`).

#### [MODIFY] src/pages/admin/.../index.html (Archivos del sidebar)
- Se añadirá la opción "Anuncios" en el menú de navegación izquierdo (`.admin-nav`) en las distintas páginas del admin.

## Verification Plan

### Manual Verification
1. Ingresar al dashboard con un negocio válido.
2. Verificar que se llame al RPC `get_my_announcements` y, si existe un modal pendiente, se despliegue con la animación de fade y scale.
3. Comprobar que cerrar el modal en "X" llame a `mark_announcement_dismissed`.
4. Comprobar que el CTA abra una nueva pestaña (link/whatsapp/phone) y llame a `mark_announcement_read`.
5. Verificar que el panel de notificaciones de la campanilla se abra correctamente en el lateral derecho y muestre notificaciones.
6. Navegar a `/admin/announcements` y verificar la interfaz de gestión.
