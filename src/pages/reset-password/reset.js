import { authService } from '../../services/auth.js'
import { buttonLoader } from '../../utils/buttonLoader.js'

const resetForm = document.getElementById('resetForm')
const message = document.getElementById('message')
const backToLoginBtn = document.getElementById('backToLogin')

backToLoginBtn.addEventListener('click', () => {
    window.location.href = '/login'
})

resetForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = document.getElementById('email').value
    const resetBtn = document.getElementById('resetBtn')

    await buttonLoader.execute(resetBtn, async () => {
        message.style.display = 'none'

        // Call authService
        const result = await authService.resetPasswordForEmail(email)

        if (result.success) {
            message.style.display = 'block'
            message.style.background = '#efe'
            message.style.color = '#383'
            message.style.borderColor = '#cfc'
            message.textContent = 'Se ha enviado un correo con las instrucciones.'
            resetForm.reset()
        } else {
            message.style.display = 'block'
            message.style.background = '#fee'
            message.style.color = '#e33'
            message.style.borderColor = '#fcc'
            message.textContent = result.error
        }
    }, 'Enviando...')
})
