import { authGuard } from '../../../utils/auth-guard.js'
import { adminService } from '../../../services/admin.js'
import { productService } from '../../../services/products.js'
import { authService } from '../../../services/auth.js'
import { notify, confirm } from '../../../utils/notifications.js'

let businessId = null
let categories = []
let previewData = []

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

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: #6b7280;">No hay productos aún.</td></tr>'
        return
    }

    tbody.innerHTML = ''
    products.forEach(p => {
        const tr = document.createElement('tr')
        tr.className = 'product-row'
        tr.innerHTML = `
            <td>${p.categories?.name || 'Sin Categoría'}</td>
            <td style="font-weight: 500;">${p.name}</td>
            <td>$${parseFloat(p.price).toLocaleString()}</td>
            <td style="text-align: right;">
                <button class="delete-btn" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
            </td>
        `
        tbody.appendChild(tr)
    })

    // Delete Listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (await confirm.show({ title: 'Eliminar', message: '¿Borrar este producto?', type: 'danger' })) {
                await productService.delete(btn.dataset.id)
                notify.success('Producto eliminado')
                loadProducts()
            }
        })
    })
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
                description: desc
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
}

function handleFile(file) {
    document.getElementById('fileName').textContent = file.name

    const reader = new FileReader()
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(sheet)

        validateAndPreview(json)
    }
    reader.readAsArrayBuffer(file)
}

function validateAndPreview(data) {
    previewData = []
    const container = document.getElementById('previewContainer')
    const tbody = document.getElementById('previewBody')
    tbody.innerHTML = ''

    let validCount = 0
    let errorsCount = 0

    // Validate first 100 rows
    const rows = data.slice(0, 50)

    rows.forEach((row, index) => {
        // Expected keys (case insensitive check usually needed, but assuming strict for now or standardizing)
        // Let's coerce keys to lowercase for standard matching
        const normalized = {}
        Object.keys(row).forEach(k => normalized[k.toLowerCase()] = row[k])

        const category = normalized['categoría'] || normalized['categoria'] || normalized['category']
        const name = normalized['nombre'] || normalized['name'] || normalized['producto']
        const price = normalized['precio'] || normalized['price']

        const isValid = category && name && !isNaN(parseFloat(price))
        if (isValid) validCount++
        else errorsCount++

        // standardized object
        const item = { category, name, price, description: normalized['descripción'] || normalized['description'] || '', isValid }
        previewData.push(item)

        // Render in preview (first 5)
        if (index < 5) {
            const tr = document.createElement('tr')
            if (!isValid) tr.className = 'row-error'
            tr.innerHTML = `
                <td>${category || '-'}</td>
                <td>${name || '-'}</td>
                <td>${price || '-'}</td>
                <td>${isValid ? '<i class="fa-solid fa-check text-success"></i>' : '<i class="fa-solid fa-times text-danger"></i>'}</td>
            `
            tbody.appendChild(tr)
        }
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

async function importProducts() {
    if (previewData.length === 0) return

    if (!(await confirm.show({
        title: 'Importar',
        message: `¿Importar ${previewData.filter(i => i.isValid).length} productos válidos?`
    }))) return

    const loading = notify.loading('Importando datos...')
    let imported = 0

    try {
        // Group by Category to minimize creation calls
        // For simplicity in this version, we handle sequentially but with local cache usage

        for (const item of previewData) {
            if (!item.isValid) continue

            // 1. Get/Create Category
            let catId = null
            const existing = categories.find(c => c.name.toLowerCase() === item.category.trim().toLowerCase())

            if (existing) {
                catId = existing.id
            } else {
                // Create new
                const { success, data } = await adminService.createCategory(businessId, item.category.trim())
                if (success) {
                    catId = data.id
                    categories.push(data) // Update local cache
                } else {
                    console.error('Failed to create category', item.category)
                    continue // Skip product if cat creation failed
                }
            }

            // 2. Create Product
            await productService.create({
                business_id: businessId,
                category_id: catId,
                name: item.name,
                price: parseFloat(item.price),
                description: item.description
            })
            imported++
        }

        notify.updateLoading(loading, `${imported} productos importados correctamente`)

        // Cleanup
        document.getElementById('fileInput').value = ''
        document.getElementById('previewContainer').style.display = 'none'
        document.getElementById('fileName').textContent = 'Haz clic o arrastra un archivo aquí'
        document.getElementById('importValidationMsg').textContent = ''
        document.getElementById('btnImport').disabled = true
        previewData = []

        loadProducts()

    } catch (e) {
        console.error(e)
        notify.updateLoading(loading, 'Error en importación', 'error')
    }
}
