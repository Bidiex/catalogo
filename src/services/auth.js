import { supabase } from '../config/supabase.js'

export const authService = {
  /**
   * Registrar un nuevo usuario con email/password
   */
  async signUp(email, password) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  /**
   * Iniciar sesión con email/password
   */
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  /**
   * Iniciar sesión con Google OAuth
   */
  async signInWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Redirigir al dashboard después del login
          redirectTo: `${window.location.origin}/auth/callback`,
          // Prompt para seleccionar cuenta cada vez (opcional)
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        }
      })

      if (error) throw error

      // signInWithOAuth redirige automáticamente, no necesita return
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  /**
   * Cerrar sesión
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  /**
   * Obtener usuario actual
   */
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  },

  /**
   * Verificar si hay sesión activa
   */
  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session
    } catch (error) {
      console.error('Error getting session:', error)
      return null
    }
  },

  /**
   * Escuchar cambios en la autenticación
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  },

  /**
   * Obtener información del proveedor del usuario
   * Útil para mostrar el avatar de Google, nombre, etc.
   */
  async getUserMetadata() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      return {
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
        avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        provider: user.app_metadata?.provider || 'email'
      }
    } catch (error) {
      console.error('Error getting user metadata:', error)
      return null
    }
  },

  /**
   * Enviar correo de recuperación de contraseña
   */
  async resetPasswordForEmail(email) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      })
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  /**
   * Actualizar usuario (para cambio de contraseña)
   */
  async updateUser(attributes) {
    try {
      const { data, error } = await supabase.auth.updateUser(attributes)
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}