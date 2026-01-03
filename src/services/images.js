import { supabase } from '../config/supabase.js'

export const imageService = {
  /**
   * Subir imagen a Supabase Storage
   */
  async upload(file, folder = 'products') {
    try {
      // Validar archivo
      if (!file) throw new Error('No se proporcionó archivo')
      
      // Validar tipo de archivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      if (!validTypes.includes(file.type)) {
        throw new Error('Formato no válido. Usa JPG, PNG o WEBP')
      }

      // Validar tamaño (máximo 5MB)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        throw new Error('La imagen es muy grande. Máximo 5MB')
      }

      // Obtener usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('Usuario no autenticado')

      // Generar nombre único
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${user.id}/${folder}/${fileName}`

      // Subir archivo
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)

      return {
        success: true,
        url: publicUrl,
        path: filePath
      }

    } catch (error) {
      console.error('Error uploading image:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Eliminar imagen de Supabase Storage
   */
  async delete(imagePath) {
    try {
      if (!imagePath) return { success: true }

      // Extraer el path relativo si es una URL completa
      let path = imagePath
      if (imagePath.includes('product-images')) {
        const parts = imagePath.split('product-images/')
        path = parts[1] || imagePath
      }

      const { error } = await supabase.storage
        .from('product-images')
        .remove([path])

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Error deleting image:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Redimensionar imagen en el cliente antes de subir
   */
  async resizeImage(file, maxWidth = 800, maxHeight = 800, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        
        img.onload = () => {
          // Calcular nuevas dimensiones manteniendo aspect ratio
          let width = img.width
          let height = img.height
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width = width * ratio
            height = height * ratio
          }

          // Crear canvas
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)

          // Convertir a blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Error al procesar imagen'))
                return
              }
              
              // Crear nuevo archivo
              const resizedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              })
              
              resolve(resizedFile)
            },
            file.type,
            quality
          )
        }
        
        img.onerror = () => reject(new Error('Error al cargar imagen'))
        img.src = e.target.result
      }
      
      reader.onerror = () => reject(new Error('Error al leer archivo'))
      reader.readAsDataURL(file)
    })
  }
}