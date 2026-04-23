import { authGuard } from '../../../utils/auth-guard.js'
import JSZip from 'jszip'
import { adminService } from '../../../services/admin.js'
import { productService } from '../../../services/products.js'
import { authService } from '../../../services/auth.js'
import { notify, confirm } from '../../../utils/notifications.js'

let businessId = null
let categories = []
let previewData = []
let zipImages = {} // Store blobs: { "filename.jpg": Blob }

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth & Init
    const { isAdmin } = await authGuard.checkAdminSession()
    if (!isAdmin) { window.location.href = '/login'; return; }

    const params = new URLSearchParams(window.location.search)
    businessId = params.get('negocio_id')
    if (!businessId) { notify.error('ID de negocio faltante'); setTimeout(() => history.back(), 2000); return; }

    const user = await authService.getCurrentUser()
    if (user) document.getElementById('adminEmail').textContent = user.email

    await loadInitialData()
    setupListeners()
})

async function loadInitialData() {
    // Business Info
    const { data: business } = await adminService.getBusinessById(businessId)
    if (business) {
        document.getElementById('pageTitle').textContent = `Setup: ${business.name}`
        const statusHtml = business.is_active
            ? '<span class="badge active">Activo</span>'
            : '<span class="badge paused">Inactivo</span>'
        document.getElementById('headerStatusBadge').innerHTML = statusHtml
    }

    // Categories & Products
    await Promise.all([loadCategories(), loadProducts()])
}

async function loadCategories() {
    const { success, data } = await adminService.getCategories(businessId)
    if (success) {
        categories = data
        renderCategorySelect()
    }
}

function renderCategorySelect() {
    const select = document.getElementById('categorySelect')
    select.innerHTML = '<option value="">-- Seleccionar --</option>'
    categories.forEach(cat => {
        const opt = document.createElement('option')
        opt.value = cat.id
        opt.textContent = cat.name
        select.appendChild(opt)
    })
}

async function loadProducts() {
    try {
        const products = await productService.getByBusiness(businessId)
        renderProductsTable(products)
    } catch (e) {
        console.error(e)
    }
}

function renderProductsTable(products) {
    const tbody = document.getElementById('productsTableBody')
    document.getElementById('productsCount').textContent = products.length

    // Limpiar selección al re-renderizar
    updateBulkBar()

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: #6b7280;">No hay productos aún.</td></tr>'
        return
    }

    tbody.innerHTML = ''
    products.forEach(p => {
        const tr = document.createElement('tr')
        tr.className = 'product-row'
        tr.dataset.id = p.id
        tr.innerHTML = `
            <td class="col-checkbox">
                <input type="checkbox" class="product-checkbox" data-id="${p.id}" aria-label="Seleccionar ${p.name}">
            </td>
            <td>${p.categories?.name || 'Sin Categoría'}</td>
            <td style="font-weight: 500;">${p.name}</td>
            <td>$${parseFloat(p.price).toLocaleString()}</td>
            <td style="text-align: right;">
                <button class="delete-btn" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
            </td>
        `
        tbody.appendChild(tr)
    })

    // Listener: actualizar barra bulk al marcar/desmarcar
    tbody.querySelectorAll('.product-checkbox').forEach(cb => {
        cb.addEventListener('change', () => updateBulkBar())
    })

    // Delete individual
    tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (await confirm.show({ title: 'Eliminar', message: '¿Borrar este producto?', type: 'danger' })) {
                await productService.delete(btn.dataset.id)
                notify.success('Producto eliminado')
                loadProducts()
            }
        })
    })
}

// ─── Selección múltiple ───────────────────────────────────────────────────────

function updateBulkBar() {
    const checkboxes = document.querySelectorAll('.product-checkbox:checked')
    const count = checkboxes.length
    const bar = document.getElementById('bulkDeleteBar')
    const label = document.getElementById('bulkDeleteLabel')
    const bulkCount = document.getElementById('bulkCount')

    if (count > 0) {
        bar.classList.add('visible')
        label.textContent = `Eliminar seleccionados (${count})`
        bulkCount.textContent = `${count} seleccionado${count > 1 ? 's' : ''}`
    } else {
        bar.classList.remove('visible')
    }
}

async function deleteSelectedProducts() {
    const checkboxes = [...document.querySelectorAll('.product-checkbox:checked')]
    const count = checkboxes.length
    if (count === 0) return

    if (!(await confirm.show({
        title: 'Eliminar productos',
        message: `¿Eliminar ${count} producto${count > 1 ? 's' : ''}? Esta acción no se puede deshacer.`,
        type: 'danger'
    }))) return

    const selectedIds = checkboxes.map(cb => cb.dataset.id)
    const msg = document.getElementById('importValidationMsg')

    const loading = notify.loading(`Eliminando ${count} productos...`)
    const { success, error } = await adminService.deleteProducts(selectedIds, businessId)

    if (!success) {
        notify.updateLoading(loading, 'Error al eliminar', 'error')
        msg.innerHTML = `<span style="color: red;">Error al eliminar: ${error}</span>`
        return
    }

    notify.updateLoading(loading, `${count} producto${count > 1 ? 's eliminados' : ' eliminado'}`)

    // Remover filas del DOM
    selectedIds.forEach(id => {
        const row = document.querySelector(`.product-row[data-id="${id}"]`)
        if (row) row.remove()
    })

    // Actualizar contador de productos
    const remaining = document.querySelectorAll('.product-row').length
    document.getElementById('productsCount').textContent = remaining

    // Limpiar barra
    updateBulkBar()

    const successMsg = `${count} producto${count > 1 ? 's eliminados' : ' eliminado'} correctamente`
    msg.innerHTML = `<span style="color: green;">✅ ${successMsg}</span>`
    notify.success(successMsg)
}

function setupListeners() {
    // 1. Toggle Category Input
    const toggleLink = document.getElementById('toggleCategoryInput')
    const input = document.getElementById('newCategoryInput')
    const select = document.getElementById('categorySelect')

    toggleLink.addEventListener('click', () => {
        if (input.style.display === 'none') {
            input.style.display = 'block'
            select.value = ''
            select.disabled = true
            toggleLink.textContent = 'Usar categoría existente'
        } else {
            input.style.display = 'none'
            input.value = ''
            select.disabled = false
            toggleLink.textContent = '+ Nueva categoría'
        }
    })

    // 2. Add Individual Product
    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
        e.preventDefault()

        const name = document.getElementById('productName').value
        const price = document.getElementById('productPrice').value
        const desc = document.getElementById('productDesc').value
        let catId = select.value
        const newCatName = input.value

        if (!catId && !newCatName) {
            notify.error('Selecciona o crea una categoría')
            return
        }

        const loading = notify.loading('Agregando producto...')

        try {
            // Create Category if needed
            if (newCatName) {
                // Check if exists in cache to avoid duplicates
                const existing = categories.find(c => c.name.toLowerCase() === newCatName.toLowerCase())
                if (existing) {
                    catId = existing.id
                } else {
                    const { success, data } = await adminService.createCategory(businessId, newCatName)
                    if (!success) throw new Error('Error al crear categoría')
                    catId = data.id
                    await loadCategories() // Refresh cache
                }
            }

            // Create Product
            await productService.create({
                business_id: businessId,
                category_id: catId,
                name,
                price: parseFloat(price),
                description: desc,
                is_active: true,
                is_available: true
            })

            notify.updateLoading(loading, 'Producto agregado')
            document.getElementById('addProductForm').reset()
            // Reset category toggle
            input.style.display = 'none'; select.disabled = false; toggleLink.textContent = '+ Nueva categoría'

            loadProducts()

        } catch (err) {
            notify.updateLoading(loading, err.message, 'error')
        }
    })

    // 3. File Upload Trigger
    const uploadArea = document.getElementById('uploadArea')
    const fileInput = document.getElementById('fileInput')

    uploadArea.addEventListener('click', () => fileInput.click())
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--primary)'; })
    uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = 'var(--border-color)'; })
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault()
        uploadArea.style.borderColor = 'var(--border-color)'
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0])
    })

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0])
    })

    // 4. Import Button
    document.getElementById('btnImport').addEventListener('click', importProducts)

    // 5. Bulk Delete Button
    document.getElementById('btnDeleteBulk').addEventListener('click', deleteSelectedProducts)
}

function handleFile(file) {
    document.getElementById('fileName').textContent = file.name

    const reader = new FileReader()
    reader.onload = async (e) => {
        const data = e.target.result

        if (file.name.endsWith('.zip')) {
            await processZip(data)
        } else {
            // Standard Excel/CSV
            const workbook = XLSX.read(data, { type: 'array' })
            processWorkbook(workbook)
        }
    }
    reader.readAsArrayBuffer(file)
}

async function processZip(data) {
    try {
        const zip = await JSZip.loadAsync(data)

        // Find Excel File (any .xlsx/.xls/.csv in the ZIP)
        const excelFile = Object.values(zip.files).find(f => !f.dir && f.name.match(/\.(xlsx|xls|csv)$/i))

        if (!excelFile) {
            notify.error('No se encontró archivo Excel (.xlsx, .xls, .csv) en el ZIP')
            return
        }

        // Extract Excel
        const excelInfo = await excelFile.async('arraybuffer')
        const workbook = XLSX.read(excelInfo, { type: 'array' })

        // Extract Images
        zipImages = {}
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp']
        const filePromises = []

        zip.forEach((relativePath, file) => {
            if (file.dir) return
            if (relativePath.includes('__MACOSX') || relativePath.startsWith('.')) return

            const lowerName = relativePath.toLowerCase()
            if (imageExtensions.some(ext => lowerName.endsWith(ext))) {
                filePromises.push((async () => {
                    const blob = await file.async('blob')
                    const basename = relativePath.split('/').pop().trim().toLowerCase()
                    zipImages[basename] = blob
                })())
            }
        })

        await Promise.all(filePromises)
        console.log('Images loaded:', Object.keys(zipImages))

        processWorkbook(workbook)

    } catch (err) {
        console.error('ZIP Error:', err)
        notify.error('Error procesando el archivo ZIP')
    }
}

function processWorkbook(workbook) {
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json(sheet)
    validateAndPreview(json)
}

// ─── Helpers para normalización de claves ─────────────────────────────────────

/**
 * Quita tildes y convierte a minúsculas para comparar sin distinción de acentos.
 * ej. "Tamaño" → "tamano", "Categoría" → "categoria"
 */
function normalize(str) {
    return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Construye un mapa de claves normalizadas → valores del row.
 * Permite acceder sin importar mayúsculas ni tildes.
 */
function buildNormalizedRow(row) {
    const result = {}
    Object.keys(row).forEach(k => { result[normalize(k)] = row[k] })
    return result
}

/**
 * Sanitiza un nombre de archivo para que sea aceptado por Supabase Storage.
 * Elimina tildes, ñ y cualquier carácter no permitido.
 * ej. "Limón 10 unds.webp" → "limon_10_unds.webp"
 */
function sanitizeFileName(name) {
    return String(name)
        .normalize('NFD')                    // descompone tildes: é → e + ́
        .replace(/[\u0300-\u036f]/g, '')     // elimina diacríticos
        .replace(/[^a-zA-Z0-9.\-_]/g, '_')  // reemplaza chars inválidos con _
        .toLowerCase()
}

/**
 * Extrae dinámicamente los pares Tamaño N / Precio tamaño N del row normalizado.
 * Retorna array de { name, price, display_order } con solo los pares válidos,
 * y un array de warnings para los pares con datos incompletos o inválidos.
 */
function extractSizes(norm) {
    const sizes = []
    const warnings = []
    let n = 1

    while (true) {
        // Acepta con o sin tilde: "tamano 1" o "tamano 1"
        const sizeName = norm[`tamano ${n}`]
        const rawPrice = norm[`precio tamano ${n}`]

        // Si no hay columna de nombre de tamaño, terminamos la búsqueda
        if (sizeName === undefined && rawPrice === undefined) break

        const cleanName = sizeName ? String(sizeName).trim() : ''
        const sizePrice = parseFloat(rawPrice)

        if (cleanName && !isNaN(sizePrice) && sizePrice > 0) {
            sizes.push({ name: cleanName, price: sizePrice, display_order: n - 1 })
        } else if (cleanName || rawPrice !== undefined) {
            // Hay datos pero son inválidos → warning
            warnings.push(`Tamaño ${n} ignorado (nombre: "${cleanName || '-'}", precio: "${rawPrice ?? '-'}")`)
        }

        n++
    }

    return { sizes, sizeWarnings: warnings }
}

// ─── Validación y preview ─────────────────────────────────────────────────────

function validateAndPreview(data) {
    previewData = []
    const container = document.getElementById('previewContainer')
    const tbody = document.getElementById('previewBody')
    tbody.innerHTML = ''

    let validCount = 0
    let errorsCount = 0

    // Limitar a 100 filas en el preview
    const rows = data.slice(0, 100)

    rows.forEach((row) => {
        const norm = buildNormalizedRow(row)

        const category = norm['categoria'] || norm['category']
        const name = norm['nombre'] || norm['name'] || norm['producto']
        const price = norm['precio'] || norm['price']

        const isValid = category && name && !isNaN(parseFloat(price))
        if (isValid) validCount++
        else errorsCount++

        // Imagen
        let imgStatus = '-'
        let hasImage = false
        const rawImgName = norm['imagen'] || norm['image'] || norm['foto']
        let matchingBlobKey = null

        if (rawImgName) {
            const cleanName = rawImgName.toString().trim().toLowerCase()
            if (zipImages[cleanName]) {
                imgStatus = `<span title="${rawImgName}">✅ ${rawImgName}</span>`
                hasImage = true
                matchingBlobKey = cleanName
            } else {
                imgStatus = `<span class="text-danger" title="No encontrada en ZIP">⚠️ ${rawImgName}</span>`
            }
        }

        // Tamaños
        const { sizes, sizeWarnings } = extractSizes(norm)
        let sizesStatus = '-'
        if (sizes.length > 0) {
            sizesStatus = `<span style="color: #16a34a; font-weight: 600;">${sizes.length} tamaño${sizes.length > 1 ? 's' : ''}</span>`
        }
        if (sizeWarnings.length > 0) {
            sizesStatus += ` <span class="text-danger" title="${sizeWarnings.join('\n')}">⚠️</span>`
        }

        // Objeto estandarizado
        const item = {
            category,
            name,
            price,
            description: norm['descripcion'] || norm['description'] || '',
            imageFile: hasImage ? matchingBlobKey : null,
            originalImageName: rawImgName,
            sizes,
            sizeWarnings,
            isValid
        }
        previewData.push(item)

        // Fila en el preview
        const tr = document.createElement('tr')
        if (!isValid) tr.className = 'row-error'
        tr.innerHTML = `
            <td>${category || '-'}</td>
            <td>${name || '-'}</td>
            <td>${price || '-'}</td>
            <td>${imgStatus}</td>
            <td>${sizesStatus}</td>
            <td>${isValid ? '<i class="fa-solid fa-check text-success"></i>' : '<i class="fa-solid fa-times text-danger"></i>'}</td>
        `
        tbody.appendChild(tr)
    })

    container.style.display = 'block'

    const msg = document.getElementById('importValidationMsg')
    if (validCount > 0) {
        msg.innerHTML = `<span style="color: green;">${validCount} filas válidas.</span> ${errorsCount > 0 ? `<span style="color: red;">${errorsCount} errores.</span>` : ''}`
        document.getElementById('btnImport').disabled = false
    } else {
        msg.innerHTML = '<span style="color: red;">No hay filas válidas para importar. Revisa las columnas.</span>'
        document.getElementById('btnImport').disabled = true
    }
}

// ─── Importación ──────────────────────────────────────────────────────────────

async function importProducts() {
    if (previewData.length === 0) return

    const validItems = previewData.filter(i => i.isValid)

    if (!(await confirm.show({
        title: 'Importar',
        message: `¿Importar ${validItems.length} productos válidos?`
    }))) return

    const loading = notify.loading('Importando datos...')
    let imported = 0
    let importedWithSizes = 0
    let importedWithoutSizes = 0
    let sizeInsertFails = 0

    try {
        for (const item of previewData) {
            if (!item.isValid) continue

            // 1. Get/Create Category
            let catId = null
            const existing = categories.find(c => c.name.toLowerCase() === item.category.trim().toLowerCase())

            if (existing) {
                catId = existing.id
            } else {
                try {
                    const { success, data, error } = await adminService.createCategory(businessId, item.category.trim())

                    if (!success) {
                        console.error('Failed to create category', item.category, error)
                        notify.error(`Error creando categoría "${item.category}": ${error || 'Desconocido'}`)
                        continue
                    }

                    catId = data.id
                    categories.push(data)
                } catch (catError) {
                    console.error('Exception creating category', item.category, catError)
                    notify.error(`Error inesperado creando categoría "${item.category}"`)
                    continue
                }
            }

            // 2. Upload Image (if any)
            let imageUrl = null
            if (item.imageFile && zipImages[item.imageFile]) {
                imageUrl = await uploadImageToStorage(zipImages[item.imageFile], item.originalImageName || item.imageFile, businessId)
            }

            // 3. Create Product
            let createdProduct = null
            try {
                createdProduct = await productService.create({
                    business_id: businessId,
                    category_id: catId,
                    name: item.name,
                    price: parseFloat(item.price),
                    description: item.description,
                    image_url: imageUrl,
                    is_active: true,
                    is_available: true
                })
            } catch (productError) {
                console.error('Error creating product', item.name, productError)
                continue
            }

            imported++
            notify.updateLoading(loading, `Importando ${imported}/${validItems.length}...`)

            // 4. Insert Sizes (if any) — fallo no revierte el producto
            if (item.sizes.length > 0 && createdProduct?.id) {
                const { success: sizesOk, error: sizesErr } = await adminService.insertProductSizes(
                    createdProduct.id,
                    item.sizes
                )
                if (sizesOk) {
                    importedWithSizes++
                } else {
                    importedWithoutSizes++ // Producto importado, pero tamaños fallaron
                    sizeInsertFails++
                    console.error(`Tamaños no guardados para "${item.name}":`, sizesErr)
                }
            } else {
                importedWithoutSizes++
            }
        }

        // Resumen final
        const summaryLines = []
        if (importedWithSizes > 0) {
            summaryLines.push(`<span style="color: green;">✅ ${importedWithSizes} producto${importedWithSizes > 1 ? 's' : ''} importado${importedWithSizes > 1 ? 's' : ''} con tamaños</span>`)
        }
        if (importedWithoutSizes - sizeInsertFails > 0) {
            const count = importedWithoutSizes - sizeInsertFails
            summaryLines.push(`<span style="color: green;">✅ ${count} producto${count > 1 ? 's' : ''} importado${count > 1 ? 's' : ''} sin tamaños</span>`)
        }
        if (sizeInsertFails > 0) {
            summaryLines.push(`<span style="color: #b45309;">⚠️ ${sizeInsertFails} producto${sizeInsertFails > 1 ? 's' : ''} con tamaños que no pudieron guardarse</span>`)
        }

        notify.updateLoading(loading, `${imported} productos importados correctamente`)

        const msg = document.getElementById('importValidationMsg')
        msg.innerHTML = summaryLines.join('<br>')

        // Cleanup
        document.getElementById('fileInput').value = ''
        document.getElementById('previewContainer').style.display = 'none'
        document.getElementById('fileName').textContent = 'Haz clic o arrastra un archivo aquí'
        document.getElementById('btnImport').disabled = true
        previewData = []
        zipImages = {}

        loadProducts()

    } catch (e) {
        console.error(e)
        notify.updateLoading(loading, 'Error en importación', 'error')
    }
}

async function uploadImageToStorage(blob, filename, businessId) {
    try {
        const safeName = sanitizeFileName(filename)
        const storagePath = `${businessId}/${Date.now()}-${safeName}`
        const { data, error } = await adminService.uploadImage(storagePath, blob)

        if (error) {
            console.error('Upload error:', error)
            return null
        }

        return data.publicUrl
    } catch (err) {
        console.error('Upload exception:', err)
        return null
    }
}
