import { defineConfig } from 'vite'
import { resolve } from 'path'
import fs from 'fs'

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
    },
    {
      name: 'flatten-html',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist')
        const srcDir = resolve(distDir, 'src/pages')

        // Helper to move file
        const moveFile = (src, dest) => {
          if (fs.existsSync(src)) {
            fs.renameSync(src, dest)
          }
        }

        // Move files to root of dist
        if (fs.existsSync(srcDir)) {
          moveFile(resolve(srcDir, 'login/index.html'), resolve(distDir, 'login.html'))
          moveFile(resolve(srcDir, 'dashboard/index.html'), resolve(distDir, 'dashboard.html'))
          moveFile(resolve(srcDir, 'catalog/index.html'), resolve(distDir, 'catalog.html'))
          moveFile(resolve(srcDir, 'product/index.html'), resolve(distDir, 'product.html'))
          moveFile(resolve(srcDir, 'reset-password/index.html'), resolve(distDir, 'reset-password.html'))
          moveFile(resolve(srcDir, 'update-password/index.html'), resolve(distDir, 'update-password.html'))
          moveFile(resolve(srcDir, '404/index.html'), resolve(distDir, '404.html'))

          // Optional: Clean up src directory in dist if empty or no longer needed
          // fs.rmSync(resolve(distDir, 'src'), { recursive: true, force: true });
        }
      }
    }
  ]
})