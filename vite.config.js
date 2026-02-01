import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'src/pages/login/index.html'),
        dashboard: resolve(__dirname, 'src/pages/dashboard/index.html'),
        catalog: resolve(__dirname, 'src/pages/catalog/index.html'),
        product: resolve(__dirname, 'src/pages/product/index.html'),
        reset_password: resolve(__dirname, 'src/pages/reset-password/index.html'),
        update_password: resolve(__dirname, 'src/pages/update-password/index.html'),
        not_found: resolve(__dirname, 'src/pages/404/index.html'),
      }
    }
  },
  plugins: [
    {
      name: 'rewrite-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Solo reescribir si NO tiene extensión (parece una ruta) y empieza con /c/
          if (req.url.startsWith('/c/') && !req.url.includes('.')) {
            req.url = '/src/pages/catalog/index.html'
          }
          next()
        })
      }
    }
  ]
})