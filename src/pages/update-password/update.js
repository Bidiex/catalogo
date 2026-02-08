import { authService } from '../../services/auth.js'
import { buttonLoader } from '../../utils/buttonLoader.js'

const updateForm = document.getElementById('updateForm')
const message = document.getElementById('message')

// Verify session primarily
// Verify session and handle password recovery flow
// Verify session and handle password recovery flow
authService.onAuthStateChange(async (event, session) => {
    // 1. Check for errors in URL (e.g. link expired)
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1)); // Remove the leading #

    const error = urlParams.get('error') || hashParams.get('error');
    const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');

    if (error) {
        message.style.display = 'block';
        message.style.background = '#fee';
        message.style.color = '#e33';
        message.style.borderColor = '#fcc';
        message.textContent = `Error: ${errorDescription || 'Enlace inválido o expirado'}. Por favor solicita uno nuevo.`;

        // Disable form
        updateForm.querySelector('button').disabled = true;
        const inputs = updateForm.querySelectorAll('input');
        inputs.forEach(input => input.disabled = true);

        // Redirect after delay
        setTimeout(() => {
            window.location.href = '/login';
        }, 5000); // 5s to read message
        return;
    }

    if (event === 'PASSWORD_RECOVERY') {
        // User indicates they are here for password recovery, valid state
        return;
    }

    if (event === 'SIGNED_IN') {
        // User is signed in, allowing update
        return;
    }

    // If we just loaded and have no session, wait a bit to see if Supabase processes the hash
    if (!session) {
        // Check if we have a hash which might indicate a magic link/recovery
        if (window.location.hash && window.location.hash.includes('type=recovery')) {
            return;
        }

        // Double check session after a short delay to ensure it wasn't just slow to load
        const currentSession = await authService.getSession();
        if (!currentSession) {
            message.style.display = 'block'
            message.textContent = 'Enlace inválido o expirado. Por favor solicita uno nuevo.'
            updateForm.querySelector('button').disabled = true
            const inputs = updateForm.querySelectorAll('input')
            inputs.forEach(input => input.disabled = true)

            setTimeout(() => {
                window.location.href = '/login'
            }, 3000)
        }
    }
})

updateForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const password = document.getElementById('password').value
    const confirmPassword = document.getElementById('confirmPassword').value
    const updateBtn = document.getElementById('updateBtn')

    if (password !== confirmPassword) {
        message.style.display = 'block'
        message.textContent = 'Las contraseñas no coinciden'
        return
    }

    await buttonLoader.execute(updateBtn, async () => {
        message.style.display = 'none'

        // Check session before attempting update
        const session = await authService.getSession();
        if (!session) {
            message.style.display = 'block';
            message.style.background = '#fee';
            message.style.color = '#e33';
            message.style.borderColor = '#fcc';
            message.textContent = 'Tu sesión ha expirado. Por favor solicita un nuevo enlace.';
            return;
        }

        const result = await authService.updateUser({ password: password })

        if (result.success) {
            message.style.display = 'block'
            message.style.background = '#efe'
            message.style.color = '#383'
            message.style.borderColor = '#cfc'
            message.textContent = 'Contraseña actualizada. Redirigiendo...'

            setTimeout(() => {
                window.location.href = '/dashboard'
            }, 2000)
        } else {
            message.style.display = 'block'
            message.style.background = '#fee'
            message.style.color = '#e33'
            message.style.borderColor = '#fcc'
            message.textContent = result.error
        }
    }, 'Actualizando...')
})
