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
        'reset-password': resolve(__dirname, 'src/pages/reset-password/index.html'),
        'update-password': resolve(__dirname, 'src/pages/update-password/index.html'),
        'auth-callback': resolve(__dirname, 'src/pages/auth/callback/index.html'),
        '404': resolve(__dirname, 'src/pages/404/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  plugins: [
    {
      name: 'rewrite-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Handle clean URLs for dev mode
          const rewrites = {
            '/login': '/src/pages/login/index.html',
            '/dashboard': '/src/pages/dashboard/index.html',
            '/catalog': '/src/pages/catalog/index.html',
            '/product': '/src/pages/product/index.html',
            '/reset-password': '/src/pages/reset-password/index.html',
            '/update-password': '/src/pages/update-password/index.html',
            '/auth/callback': '/src/pages/auth/callback/index.html',
            '/404': '/src/pages/404/index.html'
          }

          // Check for exact match first
          const urlWithoutQuery = req.url.split('?')[0]
          if (rewrites[urlWithoutQuery]) {
            req.url = rewrites[urlWithoutQuery] + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '')
          }
          // Handle /c/:slug routes
          else if (req.url.startsWith('/c/') && !req.url.includes('.')) {
            req.url = '/src/pages/catalog/index.html'
          }

          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          // Handle clean URLs for preview mode
          const rewrites = {
            '/login': '/login.html',
            '/dashboard': '/dashboard.html',
            '/catalog': '/catalog.html',
            '/product': '/product.html',
            '/reset-password': '/reset-password.html',
            '/update-password': '/update-password.html',
            '/auth/callback': '/auth-callback.html',
            '/404': '/404.html'
          }

          // Check for exact match first
          if (rewrites[req.url]) {
            req.url = rewrites[req.url]
          }
          // Handle /c/:slug routes
          else if (req.url.startsWith('/c/') && !req.url.includes('.')) {
            req.url = '/catalog.html'
          }
          // Handle query strings (e.g., /auth/callback?code=...)
          else {
            const urlWithoutQuery = req.url.split('?')[0]
            if (rewrites[urlWithoutQuery]) {
              req.url = rewrites[urlWithoutQuery] + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '')
            }
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
          moveFile(resolve(srcDir, 'auth/callback/index.html'), resolve(distDir, 'auth-callback.html'))
          moveFile(resolve(srcDir, '404/index.html'), resolve(distDir, '404.html'))

          // Optional: Clean up src directory in dist if empty or no longer needed
          // fs.rmSync(resolve(distDir, 'src'), { recursive: true, force: true });
        }
      }
    }
  ]
})