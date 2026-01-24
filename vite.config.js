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