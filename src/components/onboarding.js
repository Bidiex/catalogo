import { businessService } from '../services/business.js'
import { categoryService } from '../services/categories.js'
import { productService } from '../services/products.js'
import { notify } from '../utils/notifications.js'
import { buttonLoader } from '../utils/buttonLoader.js'
import { supabase } from '../config/supabase.js'

export class Onboarding {
  constructor() {
    console.log('🚀 Onboarding constructor llamado')
    this.currentStep = 1
    this.totalSteps = 3
    this.data = {
      business: {
        id: null,
        name: '',
        whatsapp: '',
        description: '',
        slug: ''
      },
      categories: [],
      products: []
    }
    this.container = null
    console.log('📦 Estado inicial:', this.data)
  }

  /**
   * Iniciar onboarding
   */
  start() {
    this.render()

    // Pequeño delay para asegurar que el DOM esté listo
    setTimeout(() => {
      this.showStep(1)
    }, 50)
  }

  /**
   * Renderizar estructura del onboarding
   */
  render() {
    // Crear contenedor si no existe
    if (!document.getElementById('onboarding-container')) {
      this.container = document.createElement('div')
      this.container.id = 'onboarding-container'
      this.container.className = 'onboarding-container'
      document.body.appendChild(this.container)
    } else {
      this.container = document.getElementById('onboarding-container')
    }

    this.container.innerHTML = `
      <div class="onboarding-overlay"></div>
      <div class="onboarding-modal">
        <div class="onboarding-header">
          <h2>¡Bienvenido a Catálogo SaaS! 🎉</h2>
          <p>Te ayudaremos a configurar tu negocio en 3 simples pasos</p>
        </div>

        <!-- Progress bar -->
        <div class="onboarding-progress">
          <div class="progress-steps">
            <div class="progress-step active" data-step="1">
              <div class="step-circle">1</div>
              <span class="step-label">Negocio</span>
            </div>
            <div class="progress-line"></div>
            <div class="progress-step" data-step="2">
              <div class="step-circle">2</div>
              <span class="step-label">Categorías</span>
            </div>
            <div class="progress-line"></div>
            <div class="progress-step" data-step="3">
              <div class="step-circle">3</div>
              <span class="step-label">Productos</span>
            </div>
          </div>
        </div>

        <!-- Steps content -->
        <div class="onboarding-content">
          <!-- Step 1: Business Info -->
          <div class="onboarding-step" id="step-1">
            <div class="step-icon">
              <i class="ri-store-2-line"></i>
            </div>
            <h3>Información de tu negocio</h3>
            <p class="step-description">Configura los datos básicos de tu negocio</p>
            
            <form class="onboarding-form" id="businessInfoForm">
              <div class="form-group">
                <label for="onb-business-name">Nombre del negocio *</label>
                <input type="text" id="onb-business-name" placeholder="Ej: Burger Master" required>
              </div>

              <div class="form-group">
                <label for="onb-whatsapp">Número de WhatsApp *</label>
                <input type="tel" id="onb-whatsapp" placeholder="+573001234567" required>
                <small>Incluye el código del país (ej: +57 para Colombia)</small>
              </div>

              <div class="form-group">
                <label for="onb-description">Descripción (opcional)</label>
                <textarea id="onb-description" rows="3" placeholder="Describe tu negocio..."></textarea>
              </div>
            </form>
          </div>

    <!-- Step 2: Categories -->
    <div class="onboarding-step" id="step-2" style="display: none;">
      <div class="step-icon">
        <i class="ri-folder-line"></i>
      </div>
      <h3>Categorías de productos</h3>
      <p class="step-description">Organiza tus productos en categorías</p>
      
      <div class="categories-manager">
        <div class="input-with-button">
          <input type="text" id="onb-category-input" placeholder="Ej: Hamburguesas, Bebidas, Postres...">
          <button type="button" class="btn-add-item" id="addCategoryBtn">
            <i class="ri-add-line"></i> Agregar
          </button>
        </div>

        <!-- LISTA SIMPLIFICADA -->
        <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; min-height: 100px;">
          <div id="categoriesList" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
          <p id="emptyMessage" style="text-align: center; color: #9ca3af; padding: 2rem;">Aún no has agregado categorías</p>
        </div>

        <div class="hint-box">
          <i class="ri-lightbulb-line"></i>
          <span>Puedes agregar categorías ahora o hacerlo después desde el dashboard</span>
        </div>
      </div>
    </div>

    <div class="hint-box">
      <i class="ri-lightbulb-line"></i>
      <span>Puedes agregar categorías ahora o hacerlo después desde el dashboard</span>
    </div>
  </div>
</div>

          <!-- Step 3: Products -->
          <div class="onboarding-step" id="step-3" style="display: none;">
            <div class="step-icon">
              <i class="ri-shopping-bag-line"></i>
            </div>
            <h3>Primer producto</h3>
            <p class="step-description">Agrega tu primer producto (opcional)</p>
            
            <form class="onboarding-form" id="productInfoForm">
              <div class="form-group">
                <label for="onb-product-name">Nombre del producto</label>
                <input type="text" id="onb-product-name" placeholder="Ej: Hamburguesa Clásica">
              </div>

              <div class="form-group">
                <label for="onb-product-price">Precio</label>
                <input type="number" id="onb-product-price" step="0.01" min="0" placeholder="0.00">
              </div>

              <div class="form-group" id="onb-category-select-group" style="display: none;">
                <label for="onb-product-category">Categoría</label>
                <select id="onb-product-category">
                  <option value="">Sin categoría</option>
                </select>
              </div>

              <div class="form-group">
                <label for="onb-product-description">Descripción</label>
                <textarea id="onb-product-description" rows="2" placeholder="Describe el producto..."></textarea>
              </div>
            </form>

            <div class="hint-box">
              <i class="ri-information-line"></i>
              <span>Puedes omitir este paso y agregar productos después</span>
            </div>
          </div>

          <!-- Success Step -->
          <div class="onboarding-step" id="step-success" style="display: none;">
            <div class="step-icon success">
              <i class="ri-checkbox-circle-line"></i>
            </div>
            <h3>¡Todo listo! 🎉</h3>
            <p class="step-description">Tu negocio ha sido configurado exitosamente</p>
            
            <div class="success-summary">
              <div class="summary-item">
                <i class="ri-store-2-line"></i>
                <div>
                  <strong>Negocio creado</strong>
                  <p id="summary-business-name">-</p>
                </div>
              </div>
              <div class="summary-item" id="summary-categories-item" style="display: none;">
                <i class="ri-folder-line"></i>
                <div>
                  <strong>Categorías</strong>
                  <p id="summary-categories-count">-</p>
                </div>
              </div>
              <div class="summary-item" id="summary-products-item" style="display: none;">
                <i class="ri-shopping-bag-line"></i>
                <div>
                  <strong>Productos</strong>
                  <p id="summary-products-count">-</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="onboarding-actions">
          <button type="button" class="btn-secondary" id="skipBtn" style="display: none;">
            Omitir paso
          </button>
          <button type="button" class="btn-secondary" id="backBtn" style="display: none;">
            <i class="ri-arrow-left-line"></i> Anterior
          </button>
          <button type="button" class="btn-primary" id="nextBtn">
            Siguiente <i class="ri-arrow-right-line"></i>
          </button>
          <button type="button" class="btn-primary" id="finishBtn" style="display: none;">
            Ir al Dashboard <i class="ri-arrow-right-line"></i>
          </button>
        </div>
      </div>
    `

    this.attachEventListeners()
  }

  /**
   * Adjuntar event listeners
   */
  /**
 * Adjuntar event listeners
 */
  attachEventListeners() {
    const nextBtn = document.getElementById('nextBtn')
    const backBtn = document.getElementById('backBtn')
    const skipBtn = document.getElementById('skipBtn')
    const finishBtn = document.getElementById('finishBtn')

    nextBtn.addEventListener('click', () => this.nextStep())
    backBtn.addEventListener('click', () => this.prevStep())
    skipBtn.addEventListener('click', () => this.skipStep())
    finishBtn.addEventListener('click', () => this.finish())

    // Delegación de eventos para el contenedor completo
    this.container.addEventListener('click', (e) => {
      // Botón agregar categoría
      if (e.target.id === 'addCategoryBtn' || e.target.closest('#addCategoryBtn')) {
        e.preventDefault()
        e.stopPropagation()
        console.log('Click en botón agregar categoría detectado')
        this.addCategory()
      }

      // Botón eliminar categoría
      const removeBtn = e.target.closest('.btn-remove-item')
      if (removeBtn) {
        e.preventDefault()
        const index = parseInt(removeBtn.dataset.index)
        this.removeCategory(index)
      }
    })

    // Enter en input de categoría
    this.container.addEventListener('keypress', (e) => {
      if (e.target.id === 'onb-category-input' && e.key === 'Enter') {
        e.preventDefault()
        console.log('Enter presionado en input categoría')
        this.addCategory()
      }
    })
  }

  /**
   * Mostrar paso específico
   */
  showStep(step) {
    this.currentStep = step

    // Ocultar todos los pasos
    document.querySelectorAll('.onboarding-step').forEach(s => s.style.display = 'none')

    // Mostrar paso actual
    const currentStepEl = document.getElementById(`step-${step}`)
    if (currentStepEl) {
      currentStepEl.style.display = 'block'
    }

    // Actualizar progress
    document.querySelectorAll('.progress-step').forEach((s, index) => {
      if (index + 1 < step) {
        s.classList.add('completed')
        s.classList.remove('active')
      } else if (index + 1 === step) {
        s.classList.add('active')
        s.classList.remove('completed')
      } else {
        s.classList.remove('active', 'completed')
      }
    })

    // Actualizar botones
    this.updateButtons()

    // Hacer focus en el input de categorías si es paso 2
    if (step === 2) {
      setTimeout(() => {
        const input = document.getElementById('onb-category-input')
        if (input) input.focus()
      }, 100)
    }
  }

  /**
   * Actualizar visibilidad de botones
   */
  updateButtons() {
    const nextBtn = document.getElementById('nextBtn')
    const backBtn = document.getElementById('backBtn')
    const skipBtn = document.getElementById('skipBtn')
    const finishBtn = document.getElementById('finishBtn')

    backBtn.style.display = this.currentStep > 1 ? 'block' : 'none'
    skipBtn.style.display = (this.currentStep === 2 || this.currentStep === 3) ? 'block' : 'none'

    // Mostrar "Siguiente" en pasos 1, 2 y 3
    nextBtn.style.display = this.currentStep <= this.totalSteps ? 'block' : 'none'

    // Cambiar texto del botón en paso 3
    if (this.currentStep === 3) {
      nextBtn.innerHTML = 'Finalizar <i class="ri-check-line"></i>'
    } else {
      nextBtn.innerHTML = 'Siguiente <i class="ri-arrow-right-line"></i>'
    }

    finishBtn.style.display = 'none'
  }

  /**
   * Siguiente paso
   */
  async nextStep() {
    const nextBtn = document.getElementById('nextBtn')

    // Validar paso actual
    // Validar paso actual
    if (this.currentStep === 1) {
      const form = document.getElementById('businessInfoForm')
      if (!form.checkValidity()) {
        form.reportValidity()
        return
      }

      // Guardar datos del negocio
      this.data.business.name = document.getElementById('onb-business-name').value
      this.data.business.whatsapp = document.getElementById('onb-whatsapp').value
      this.data.business.description = document.getElementById('onb-description').value

      // Si ya tiene ID, significa que ya fue creado, solo avanzar
      if (this.data.business.id) {
        this.showStep(2)
        return
      }

      // Crear negocio en la BD solo si no existe
      await buttonLoader.execute(nextBtn, async () => {
        try {
          const slug = businessService.generateSlug(this.data.business.name)
          const businessData = {
            name: this.data.business.name,
            slug: slug,
            whatsapp_number: this.data.business.whatsapp,
            description: this.data.business.description
          }

          const createdBusiness = await businessService.createBusiness(businessData)
          this.data.business.id = createdBusiness.id
          this.data.business.slug = createdBusiness.slug

          this.showStep(2)
        } catch (error) {
          console.error('Error creating business:', error)
          notify.error('Error al crear el negocio: ' + error.message)
        }
      }, 'Creando negocio...')
    } else if (this.currentStep === 2) {
      // Guardar categorías en la BD
      await buttonLoader.execute(nextBtn, async () => {
        try {
          if (this.data.categories.length > 0) {
            const promises = this.data.categories.map((cat, index) => {
              return categoryService.create({
                business_id: this.data.business.id,
                name: cat,
                display_order: index
              })
            })
            await Promise.all(promises)
          }

          // Actualizar select de categorías en step 3
          this.updateCategorySelect()
          this.showStep(3)
        } catch (error) {
          console.error('Error creating categories:', error)
          notify.error('Error al crear las categorías')
        }
      }, 'Guardando...')

    } else if (this.currentStep === 3) {
      // Crear producto si se llenó
      await buttonLoader.execute(nextBtn, async () => {
        try {
          const productName = document.getElementById('onb-product-name').value.trim()
          const productPrice = document.getElementById('onb-product-price').value

          // Si hay nombre y precio, crear producto
          if (productName && productPrice) {
            console.log('=== Creando producto ===')

            const categorySelectValue = document.getElementById('onb-product-category').value
            const description = document.getElementById('onb-product-description').value

            // Obtener el ID real de la categoría desde Supabase
            let categoryId = null

            if (categorySelectValue && categorySelectValue !== '' && this.data.categories.length > 0) {
              const categoryIndex = parseInt(categorySelectValue)
              const categoryName = this.data.categories[categoryIndex]

              console.log('Buscando categoría:', categoryName)

              // Buscar el ID real de la categoría en Supabase
              try {
                const { data: categoryData, error: catError } = await supabase
                  .from('categories')
                  .select('id')
                  .eq('business_id', this.data.business.id)
                  .eq('name', categoryName)
                  .single()

                if (!catError && categoryData) {
                  categoryId = categoryData.id
                  console.log('ID de categoría encontrado:', categoryId)
                }
              } catch (error) {
                console.error('Error buscando categoría:', error)
              }
            }

            console.log('Datos del producto a crear:', {
              business_id: this.data.business.id,
              name: productName,
              price: parseFloat(productPrice),
              category_id: categoryId,
              description: description
            })

            await productService.create({
              business_id: this.data.business.id,
              name: productName,
              price: parseFloat(productPrice),
              category_id: categoryId,
              description: description || '',
              image_url: '',
              is_available: true,
              display_order: 0
            })

            this.data.products.push(productName)
            console.log('✅ Producto creado exitosamente')
          } else {
            console.log('No se creará producto (campos vacíos o incompletos)')
          }

          this.showSuccess()
        } catch (error) {
          console.error('Error creating product:', error)
          notify.error('Error al crear el producto: ' + error.message)
        }
      }, 'Finalizando...')
    }
  }

  /**
   * Paso anterior
   */
  prevStep() {
    if (this.currentStep > 1) {
      this.showStep(this.currentStep - 1)
    }
  }

  /**
   * Omitir paso
   */
  async skipStep() {
    if (this.currentStep === 2) {
      this.updateCategorySelect()
      this.showStep(3)
    } else if (this.currentStep === 3) {
      this.showSuccess()
    }
  }

  /**
   * Agregar categoría
   */
  addCategory() {
    console.log('=== addCategory() NUEVA VERSIÓN ===')

    const input = document.getElementById('onb-category-input')

    if (!input) {
      console.error('❌ Input no encontrado')
      notify.error('Error: Input no encontrado')
      return
    }

    const value = input.value.trim()
    console.log('Valor:', value)

    if (!value) {
      notify.warning('Escribe el nombre de la categoría')
      return
    }

    if (this.data.categories.includes(value)) {
      notify.warning('Esta categoría ya fue agregada')
      return
    }

    // Agregar a la lista
    this.data.categories.push(value)
    console.log('✅ Categoría agregada. Total:', this.data.categories.length)
    console.log('Lista completa:', this.data.categories)

    // Limpiar input
    input.value = ''
    input.focus()

    // Renderizar
    this.renderCategories()

    notify.success(`"${value}" agregada`)

    // Verificación adicional
    setTimeout(() => {
      const list = document.getElementById('categoriesList')
      console.log('Verificación post-render:')
      console.log('  Items en DOM:', list?.children.length)
      console.log('  Categorías en data:', this.data.categories.length)
    }, 100)
  }

  /**
   * Eliminar categoría
   */
  removeCategory(index) {
    console.log(`Eliminando índice ${index}:`, this.data.categories[index])
    this.data.categories.splice(index, 1)
    console.log('Categorías restantes:', this.data.categories)
    this.renderCategories()
    notify.info('Categoría eliminada')
  }

  /**
   * Renderizar lista de categorías
   */
  renderCategories() {
    console.log('=== renderCategories() NUEVA VERSIÓN ===')
    console.log('Categorías:', this.data.categories)

    const list = document.getElementById('categoriesList')
    const emptyMessage = document.getElementById('emptyMessage')

    if (!list) {
      console.error('❌ categoriesList no encontrado')
      return
    }

    if (!emptyMessage) {
      console.error('❌ emptyMessage no encontrado')
      return
    }

    // Limpiar lista
    list.innerHTML = ''

    if (this.data.categories.length === 0) {
      console.log('Sin categorías, mostrando mensaje')
      emptyMessage.style.display = 'block'
      list.style.display = 'none'
      return
    }

    // Ocultar mensaje vacío
    emptyMessage.style.display = 'none'
    list.style.display = 'flex'

    // Crear elementos uno por uno
    this.data.categories.forEach((cat, index) => {
      console.log(`Creando elemento para: ${cat}`)

      // Crear contenedor
      const item = document.createElement('div')
      item.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: #f9fafb;
      border: 1px solid #ddd;
      border-radius: 0.5rem;
      width: 100%;
    `

      // Crear span con el nombre
      const span = document.createElement('span')
      span.textContent = cat
      span.style.cssText = 'font-weight: 500; color: #222; flex: 1;'

      // Crear botón eliminar
      const button = document.createElement('button')
      button.type = 'button'
      button.innerHTML = '<i class="ri-close-line"></i>'
      button.style.cssText = `
      background: none;
      border: none;
      color: #ef4444;
      cursor: pointer;
      padding: 0.25rem;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.25rem;
    `
      button.onclick = () => {
        console.log(`Eliminando categoría: ${cat}`)
        this.removeCategory(index)
      }

      // Ensamblar
      item.appendChild(span)
      item.appendChild(button)
      list.appendChild(item)

      console.log(`✅ Elemento creado y agregado para: ${cat}`)
    })

    console.log('✅ Render completo. Items en el DOM:', list.children.length)
  }

  /**
   * Actualizar select de categorías en step 3
   */
  updateCategorySelect() {
    const selectGroup = document.getElementById('onb-category-select-group')
    const select = document.getElementById('onb-product-category')

    console.log('=== updateCategorySelect() ===')
    console.log('Categorías disponibles:', this.data.categories)

    if (this.data.categories.length > 0) {
      selectGroup.style.display = 'flex'
      select.innerHTML = '<option value="">Sin categoría</option>' +
        this.data.categories.map((cat, index) => `<option value="${index}">${cat}</option>`).join('')
      console.log('Select actualizado con', this.data.categories.length, 'categorías')
    } else {
      selectGroup.style.display = 'none'
      console.log('No hay categorías, ocultando select')
    }
  }

  /**
   * Mostrar pantalla de éxito
   */
  showSuccess() {
    document.getElementById('step-3').style.display = 'none'
    document.getElementById('step-success').style.display = 'block'

    document.getElementById('nextBtn').style.display = 'none'
    document.getElementById('backBtn').style.display = 'none'
    document.getElementById('skipBtn').style.display = 'none'
    document.getElementById('finishBtn').style.display = 'block'

    // Actualizar progress
    document.querySelectorAll('.progress-step').forEach(s => {
      s.classList.add('completed')
      s.classList.remove('active')
    })

    // Llenar resumen
    document.getElementById('summary-business-name').textContent = this.data.business.name

    if (this.data.categories.length > 0) {
      document.getElementById('summary-categories-item').style.display = 'flex'
      document.getElementById('summary-categories-count').textContent =
        `${this.data.categories.length} categoría${this.data.categories.length > 1 ? 's' : ''} creada${this.data.categories.length > 1 ? 's' : ''}`
    }

    if (this.data.products.length > 0) {
      document.getElementById('summary-products-item').style.display = 'flex'
      document.getElementById('summary-products-count').textContent =
        `${this.data.products.length} producto${this.data.products.length > 1 ? 's' : ''} creado${this.data.products.length > 1 ? 's' : ''}`
    }
  }

  /**
   * Finalizar onboarding
   */
  finish() {
    // Recargar página para mostrar dashboard completo
    window.location.reload()
  }

  /**
   * Cerrar onboarding
   */
  close() {
    if (this.container) {
      this.container.remove()
    }
  }
}