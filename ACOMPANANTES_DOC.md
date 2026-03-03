# Funcionamiento de la característica "Acompañantes" (Sides)

## 1. Introducción
La funcionalidad de "Acompañantes" (internamente documentada en el código como `sides`) permite a los negocios ofrecer extras o adiciones opcionales que los clientes pueden seleccionar al ordenar un producto. Esta funcionalidad se encarga de calcular precios adicionales cuando así corresponda y sumar dichos montos al costo final del producto.

## 2. Gestión por parte del Negocio (`dashboard.js` & `index.html`)
El dueño del negocio configura los acompañantes en su panel de administración a través del modal de opciones del producto (`productOptionsModal`).

- **Estructura en la Interfaz (UI):** Los acompañantes se inyectan dinámicamente en un contenedor dedicado que tiene el ID `#sidesListDashboard`.
- **Lógica de Consulta:** Se invocan temporalmente de la base de datos a través del servicio genérico de opciones `productOptionsService.getByProduct(productId)`. De todos los resultados devueltos, el sistema localiza y filtra un sub-arreglo basándose en la condición `type === 'side'`.
- **Creación y Edición:** Al hacer clic en el botón `+ Agregar` (`#addSideBtn`), el código activa el modal genérico (`optionModal`). Automáticamente se define la variable `editingOptionType = 'side'`, de forma que al guardar, este nuevo elemento se identifique como acompañante. A diferencia de los grupos de opciones avanzados, los acompañantes se insertan con el atributo `group_id: null`.
- **Atributos de Datos Principales:** Un acompañante almacena:
  - `name`: Etiqueta descriptiva (por ej., "Papas Cascas", "Adición de Queso").
  - `price`: Cuota adicional al precio base. Si se ingresa `0`, este figura en la tienda virtual sin generar un sobrecargo.

## 3. Visualización en el Catálogo de Clientes (`catalog.js`)
Cuando un cliente hace clic en un producto y despliega el modal interactivo de la tienda virtual, el código consulta nuevamente las opciones disponibles de ese ítem.

- **Filtrado previo:** Al igual que en la edición administrativa, se revisan las opciones no agrupadas (`ungroupedOptions`) que tengan la propiedad de `type === 'side'`.
- **Renderizado Dinámico:** Los acompañantes se inyectan en el DOM (`<div class="sides-list">`) en forma de múltiples casillas de verificación (elementos `<input type="checkbox">`). Cada una de estas opciones va en concordancia a una etiqueta con su respectivo nombre, evidenciando un texto verde claro (o de énfasis primario) que marca el precio formateado adicional si aplica, ej. `+$2.000`.
- **Recolección:** A diferencia de algunos grupos de opciones que aplican restricciones y topes máximos de selecciones obligatorias, los acompañantes tradicionales operan como adiciones opcionales libres donde el usuario puede activar tantas opciones como acompañantes encuentre en la lista.
- Una vez el cliente selecciona los *checkboxes* que desea, su elección se encapsula en arreglos antes del envío oficial mediante la ejecución del botón "Agregar al Carrito" (`addToCartBtn`).

## 4. Lógica de Carrito y Checkout (`cart.js` & `catalog.js`)
El instante en que el usuario agrega a su carrito desencadena los mecanismos de agrupación monetaria de los acompañantes vinculados.

- **Estructura dentro del Carrito:** Los datos específicos elegidos se mapean al arreglo interno `legacySides` y se empaquetan en el núcleo del carrito en cascada dentro de `item.options.sides`.
- **Cálculo de Precios Unificados:** Dentro de la función que recalcula el panel del carrito (`renderCartItems`), el algoritmo recupera el costo "Unitario Base" que tiene dicho producto e itera un ciclo de suma iterativo sobre cada variable `side.price` dentro del objeto guardado. Posteriormente, toma la sumatoria absoluta y la multiplica por la cantidad configurada del producto (ej: [(Producto en $10) + (Salsa en $2) + (Papa en $3)] * 2 cant = Total $30).
- **Actualización Visual al Cliente:** Se proyecta cada acompañante en formato de jerarquía viñeteada debajo del título central del producto. Para mayor transparencia al pagar, se acompaña de su precio adjunto: `+ Nombre Acompañante ($Precio)`. 
- **Persistencia hacia la Base de Datos:** Cuando se confirma un pedido final, los totales y sub-nodos se re-validan en las funciones de checkout, reestructurando los JSON y guardándolos en la base de datos de los pedidos, reflejándose en cada `orderItem`.
- **Integración con WhatsApp:** Paralelamente, si se deriva el pedido mediante WhatsApp, la información viaja y el template concatena estas adiciones en las múltiples líneas que describen qué conforma cada producto.

## 5. Referencia en la Estructura (Supabase)
Toda esta información persiste presumiblemente de las tablas conectadas a `productOptionsService`.
- **Columna Identificadora:** Su tipificación clave es que tienen la columna `type` fijada al valor constante `'side'`.
- **Padre Referente:** A nivel relacional, viven vinculadas directamente por la columna `product_id`.

## 6. Diferencia Principal contra los "Grupos" y "Comentarios" (Legacy)
Es de gran relevancia para el desarrollador entender la nota de coexistencia dentro del código. Dentro de las configuraciones y recolecciones, a menudo se refieren a los acompañantes con el término de código **(Legacy)**:
- A diferencia de un **Comentario rápido (`quick_comment`)**, los acompañantes otorgan la virtud directa de modificar el cálculo matemático de una orden para sobrecargar positivamente el precio unitario del producto si es que no fuese nulo.
- A diferencia de los actuales **"Grupos de Opciones" (Grupos Múltiples/Radio Automático)** que implementa el ecosistema actual, los acompañantes no son asignables a un contenedor que regule topes como "Debes seleccionar mínimo 1 y máximo 2 para avanzar".
- No obstante, debido a su practicidad y valor heredado en la configuración visual y rápida aportada al negociante, operan conjuntamente en paralelo con la característica de Grupos de opciones moderna para cumplir su propósito directo.
