# Documentación UI y Funcionalidad de la Plataforma de Domiciliarios (TraeGo)

Directorio analizado: `src/pages/delivery`

Esta plataforma (accesible mediante el slug de negocio `/d/{slug}`) es una aplicación **optimizada para dispositivos móviles** («Mobile-first») construida en base a Vanilla JavaScript, HTML5 y CSS3 nativo, integrada con Supabase. No utiliza frameworks complejos, buscando un alto rendimiento y ligereza.

---

## 🏗 Aspectos Estructurales (HTML)
El archivo `index.html` sirve como contenedor principal (SPA - Single Page Application) y gestiona distintas "pantallas" que cambian de visibilidad controlando las clases `.hidden`.

### 1. Pantallas Principales
- **Pantalla de Carga (`#loadingScreen`):** Spinner de carga que incorpora el logo con animación rotatoria al inicio de la aplicación o al cargar las órdenes iniciales.
- **Pantalla No Encontrado (`#notFoundScreen`):** Mensaje amigable cuando el `slug` del negocio de la URL no es válido o está inactivo.
- **Warning de Escritorio (`#desktopWarning`):** Pantalla condicional visible solo por Media Query (CSS) en pantallas grandes (>1025px) pidiendo al usuario ingresar desde su teléfono inteligente/tablet.

### 2. Login Flow
El sistema de inicio de sesión no utiliza usuario y contraseña tradicionales, sino un **Código Único de 6 dígitos** ligado al domiciliario.
- **Intro UI:** Visual enriquecida (`.login-visual-env`) con items flotantes animados (casco, moto, maleta) y el avatar principal del domiciliario. Un gran botón "Ingresar" inicia el flujo.
- **Modal de Acceso (`#loginModal`):** Un diseño tipo Sheet/Modal que se eleva mostrando información del negocio a loguearse junto al formulario OTP.
- **Login OTP:** Contenedor de 6 `input` tipo texto (un carácter cada uno) adaptado a lectura rápida, pegado múltiple de caracteres de portapapeles y auto-validación dinámica tras ingresar el último dígito sin necesidad de pulsar un botón de "Enviar". Incorpora un botón de contacto por WhatsApp de ayuda en caso de extraviar el código.

### 3. Aplicación Principal (`#appScreen`)
Desbloqueada una vez el `unique_code` del domiciliario es validado y sus datos son guardados en `sessionStorage`.
Se compone de:
- **Top Header:** Muestra el logo dinámico del negocio en sesión, nombre del negocio, nombre del domiciliario y botón de `Logout`. Además de un título del tab activo con notificador visual (badge) de nuevos pedidos.
- **Bottom Navigation (`#bottomNav`):** Barra inferior de pestañas optimizada al pulgar con iconos (disponibles, mis pedidos, métricas).

---

## 🎨 Aspectos de Estilos (CSS)
El archivo `delivery.css` estructura visualmente todo el contexto, evitando `!important` y logrando adaptabilidad de manera escalable y prolija.

- **Diseño Mobile-First:** Enfocado al uso de botones grandes, tarjetas accesibles y `bottom-nav` al alcance del pulgar, aplicando márgenes generosos para evitar clicks errados.
- **Variables de Color Dinámicas:** Soporte de colores base estándar (Verde Primaveral, Azules, Rojos) para distintos estados además de calcular el color corporativo o variantes tenues (e.g., `hexToLightBg`).
- **Estados Visuales y Tipografía:** Uso de la fuente Inter. Estados condicionales y legibilidad optimizada mediante sombras (shadow-card/elevated).
- **Semántica de Tiempos:** Los pedidos cambian su color indicador de tiempo (`elapsed-good`, `elapsed-amber`, `elapsed-danger` y parpadeo `.delayed`) para ilustrar el tiempo en espera mediante la urgencia (amarillo a los 10 mins, rojo a los 20 mins).
- **Animaciones Suaves (Keyframes):** Flotación suave constante de los ítems decorativos en el login, spinners fluidos e ingreso progresivo (fade-in, slide-up modal) de los modales y notificaciones Toast que brindan una experiencia Premium y nativa.

---

## ⚙️ Funcionalidad y Lógica Transaccional (JS)
El archivo `delivery.js` contiene los métodos y flujos asíncronos interactuando fuertemente con Supabase, DOM manipulation, y Supabase Realtime para notificar al repartidor sin necesidad de refrescar la pantalla.

### Sistema de Navegación por Secciones
Cambiando el DOM según la navegación del usuario e inyectando las tarjetas de pedidos respectivas.

#### 📍 Sección A: Pedidos Disponibles (`#section-pending`)
Muestra pedidos que ya pasaron a estado `ready` en el dashboard del negocio (empacados y listos) pero que **aún no tienen asignado un repartidor**.
- **Tarjetas Base:** Desglose del número de orden, cliente, dirección, monto total y tiempo transcurrido desde que estuvo listo (actualizado vía un setInterval).
- **Acción:** Botón "Tomar Pedido". Esto ejecuta una validación de concurrencia en Base de datos (Procedimiento almacenado de Supabase `delivery_take_order`) para evitar que dos repartidores tomen el mismo pedido a la vez.

#### 📍 Sección B: Mis Pedidos (`#section-mine`)
Muestra aquellos pedidos que el domiciliario auto-tomó o le asignaron. Se asume en su estado como `dispatched` (para control del sistema).
- **Comunicación Integrada:** Acceso ultrarrápido a Llamada Tradicional (`tel:`) o enlace directo de WhatsApp auto-generando un formato de mensaje del tipo *"Hola, soy [NombreDomi], el domiciliario de [Negocio], te contacto..."*
- **Ver Dirección:** Vinculación estricta con Google Maps Search API basado en la dirección y su barrio para lograr trazado de rutas.
- **Restricciones y Cumplimiento:**
  - Opción de solicitar cancelación si el cliente no responde.
  - Opción rápida de adjuntar **Anotaciones** (problemas menores, notas específicas).
  - Obligatoriedad (opcional dependiente si suben imagen) de subir una **Foto de Evidencia**. Se activa la entrada de cámara nativa del móvil, y el archivo pre-optimiza en cliente antes de interactuar y completar el pedido firmemente (sube al bucket de evidency_photos).
- Acciona el procedure `delivery_complete_order` logrando el paso exitoso del pedido.

#### 📍 Sección C: Métricas (`#section-metrics`)
Una interfaz purista donde el repartidor ve un estado del arte de su rendimiento.
- **Filtros Temporales:** Hoy, Esta Semana, Este Mes.
- **Cálculo Desglosado:** Conteo de tareas completadas, e historización local de tiempos calculando el **Tiempo Promedio de entrega** (midiendo desde el estatus dispatch hasta su completion).
- **Historial Finito:** Se cargan las tarjetas en lista de las últimas interacciones para constancia del chofer de sus envíos exitosos ese día/semana.

### Lógica Miscelánea Clave:
- **Optimización de Fotografías:** Implementación paralela de comprensión binaria de la imagen adjuntada para reducir latencia y tamaño global de BD sin perder detalle de la etiqueta fotográfica de la entrada de paquete.
- **Suscripciones (`supabase channel`):** Mantienen atado en tiempo real escuchando modificaciones e inserciones a la tabla `orders`, de tal modo, si cocina lanza 3 pedidos más a estado `ready`, el celular brinca y muestra una burbuja en el header inmediatamente informando al piloto.
