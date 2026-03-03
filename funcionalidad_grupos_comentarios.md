# Funcionalidad de Grupos de Comentarios Rápidos en el SaaS

Este documento detalla, de manera técnica y funcional, cómo opera la característica de "Grupos de Comentarios Rápidos" (o Grupos de Opciones) a través de todo el SaaS, desde la base de datos hasta la experiencia del cliente final en el catálogo.

## 1. Arquitectura y Modelo de Datos (Supabase)
La funcionalidad se sostiene sobre dos tablas principales en la base de datos:

*   **`product_option_groups`**: Representa la agrupación lógica de opciones (ej. "Término de la carne", "Salsas", "Adiciones").
    *   `id`: Identificador único del grupo.
    *   `product_id`: Llave foránea que lo vincula a un producto específico.
    *   `name`: Nombre del grupo visible para el cliente (ej. "Elige tus salsas").
    *   `type`: Define el comportamiento del grupo. Puede ser `radio` (selección única obligatoria) o `checkbox` (selección múltiple).
    *   `min_selections`: Cantidad mínima de opciones que el usuario debe elegir (0 = opcional, >0 = obligatorio).
    *   `max_selections`: Límite máximo de selecciones permitidas en tipo `checkbox` (0 = sin límite).
    *   `display_order`: Para mantener el orden visual en la UI.
*   **`product_options`**: Almacena las opciones individuales ("Comentarios rápidos") que pertenecen a un grupo. 
    *   `group_id`: Relaciona la opción con su grupo padre en `product_option_groups`.
    *   `name`: El texto de la opción (ej. "Salsa de ajo", "Bien cocido").
    *   `price`: (Opcional) Un valor monetario adicional que se suma al producto si se selecciona esta opción.
    *   *Nota Legacy*: El sistema mantiene compatibilidad con "Comentarios Rápidos Legacy", los cuales son `product_options` que no tienen `group_id` asignado y tienen el tipo `quick_comment`.

## 2. Gestión desde el Dashboard (Lado del Comercio)
La administración de los grupos ocurre en el archivo `src/pages/dashboard/dashboard.js`, específicamente al manipular los productos:

1.  **Creación/Edición del Grupo**: 
    *   Dentro del panel de opciones de un producto, el comercio puede hacer clic en "Nuevo Grupo".
    *   Se abre un modal (`#groupModal`) donde el usuario define el nombre, si es selección única (`radio`) o múltiple (`checkbox`), y los límites mínimos/máximos.
    *   El formulario interactúa con `productOptionsService.createGroup` que inserta en la base de datos.
2.  **Agregado de Opciones al Grupo**: 
    *   Una vez creado el grupo, se visualiza en un contenedor y habilita el botón "+ Opción".
    *   Esto abre el modal estándar de opciones, pero vinculándolo automáticamente al `group_id`.
    *   El comercio especifica el nombre del comentario/opción y, opcionalmente, un costo adicional.
3.  **Renderizado**: 
    *   La UI itera sobre la lista `productOptionGroups` y dibuja cada grupo con sus respectivas opciones anidadas, mostrando controles para editar o eliminar de manera individual o por bloque.

## 3. Experiencia en el Catálogo (Lado del Cliente)
Cuando un comprador navega en el catálogo público (`src/pages/catalog/catalog.js`), la interacción funciona de la siguiente manera:

1.  **Apertura del Producto (`openProductModal`)**:
    *   Al hacer clic en un producto, el sistema llama al servicio `productOptionsService.getGroupsByProduct(productId)` para recuperar todos los grupos y sus opciones incrustadas.
    *   Estos datos se almacenan en memoria y se dispara la función `renderProductOptions()`.
2.  **Renderizado Condicional (`renderProductOptions`)**:
    *   Se recorren dinámicamente todos los grupos.
    *   Si `min_selections > 0`, se muestra una etiqueta roja visual de `* Obligatorio`.
    *   Si hay `max_selections`, se le indica al usuario el límite con un texto `(Máx. X)`.
    *   Se renderizan inputs HTML estándar (`<input type="radio">` o `<input type="checkbox">`) agrupados por el `name` del atributo HTML para forzar o permitir la selección múltiple nativa del navegador.
3.  **Validación de Compra (`addToCartBtn.addEventListener`)**:
    *   Al intentar agregar el producto al carrito, el sistema hace un ciclo validando grupo por grupo las reglas establecidas.
    *   Cuenta cuántos `inputs` activos (checked) hay por contenedor de grupo.
    *   Si `selectedCount < min_selections`, detiene el flujo y lanza un `notify.warning` indicando: *"Debes seleccionar al menos X opción(es) en [Nombre del Grupo]"*.
    *   Mismo flujo para `max_selections`: Si `selectedCount > max_selections`, lanza una alerta preventiva.
    *   Solo si pasa todas las validaciones de todos los grupos, junta las selecciones en un arreglo estructurado (nombre de grupo + items seleccionados con sus precios).

## 4. Carrito de Compras
1.  **Estructuración (`updateCartUI` y `renderCartItems`)**:
    *   Las selecciones aprobadas empacan en el objeto del carrito bajo la propiedad `options.groups`.
    *   Al renderizar el panel lateral del carrito, se desglosan: se muestra el nombre del grupo en texto menor y, separadas por comas, las opciones seleccionadas (añadiendo la leyenda de sobrecosto `+$X` solo si aplica).
    *   La suma total del pedido considera el precio base (o con descuento) del producto más la acumulación (`reduce`) de todos los costos adicionales (si existieran) de los comentarios rápidos seleccionados.
