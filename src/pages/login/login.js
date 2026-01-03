import { authService } from '../../services/auth.js'
import { notify } from '../../utils/notifications.js'
import { buttonLoader } from '../../utils/buttonLoader.js'

// Elementos del DOM
const loginForm = document.getElementById('loginForm')
const registerForm = document.getElementById('registerForm')
const toggleRegisterBtn = document.getElementById('toggleRegister')
const backToLoginBtn = document.getElementById('backToLogin')
const errorMessage = document.getElementById('errorMessage')
const registerErrorMessage = document.getElementById('registerErrorMessage')

// Verificar si ya hay sesión activa
checkExistingSession()

async function checkExistingSession() {
  const session = await authService.getSession()
  if (session) {
    // Si ya hay sesión, redirigir al dashboard
    window.location.href = '/src/pages/dashboard/index.html'
  }
}

// Toggle entre login y registro
toggleRegisterBtn.addEventListener('click', () => {
  loginForm.style.display = 'none'
  toggleRegisterBtn.style.display = 'none'
  registerForm.style.display = 'flex'
  document.querySelector('.divider').style.display = 'none'
})

backToLoginBtn.addEventListener('click', () => {
  registerForm.style.display = 'none'
  loginForm.style.display = 'flex'
  toggleRegisterBtn.style.display = 'block'
  document.querySelector('.divider').style.display = 'flex'
  registerErrorMessage.style.display = 'none'
})

// Manejo del login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const loginBtn = document.getElementById('loginBtn')

  await buttonLoader.execute(loginBtn, async () => {
    errorMessage.style.display = 'none'

    const result = await authService.signIn(email, password)

    if (result.success) {
      window.location.href = '/src/pages/dashboard/index.html'
    } else {
      errorMessage.textContent = result.error
      errorMessage.style.display = 'block'
    }
  }, 'Iniciando sesión...')
})

// Manejo del registro
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const email = document.getElementById('registerEmail').value
  const password = document.getElementById('registerPassword').value
  const confirmPassword = document.getElementById('confirmPassword').value
  const registerBtn = document.getElementById('registerBtn')

  if (password !== confirmPassword) {
    registerErrorMessage.textContent = 'Las contraseñas no coinciden'
    registerErrorMessage.style.display = 'block'
    return
  }

  await buttonLoader.execute(registerBtn, async () => {
    registerErrorMessage.style.display = 'none'

    const result = await authService.signUp(email, password)

    if (result.success) {
      registerErrorMessage.style.display = 'block'
      registerErrorMessage.style.background = '#efe'
      registerErrorMessage.style.color = '#383'
      registerErrorMessage.style.borderColor = '#cfc'
      registerErrorMessage.textContent = '¡Cuenta creada! Revisa tu email para confirmar tu cuenta.'

      registerForm.reset()
    } else {
      registerErrorMessage.textContent = result.error
      registerErrorMessage.style.display = 'block'
    }
  }, 'Creando cuenta...')
})