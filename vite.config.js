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
        'admin-dashboard': resolve(__dirname, 'src/pages/admin/dashboard/index.html'),
        'admin-users': resolve(__dirname, 'src/pages/admin/users/index.html'),
        'admin-businesses': resolve(__dirname, 'src/pages/admin/businesses/index.html'),
        'admin-business-detail': resolve(__dirname, 'src/pages/admin/business-detail/index.html'),
        'admin-setup-catalogo': resolve(__dirname, 'src/pages/admin/setup-catalogo/index.html'),
        'admin-support': resolve(__dirname, 'src/pages/admin/support/index.html'),

        'links': resolve(__dirname, 'src/pages/links/index.html'),
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
            '/admin/dashboard': '/src/pages/admin/dashboard/index.html',
            '/admin/users': '/src/pages/admin/users/index.html',
            '/admin/businesses': '/src/pages/admin/businesses/index.html',
            '/admin/business-detail': '/src/pages/admin/business-detail/index.html',
            '/admin/setup-catalogo': '/src/pages/admin/setup-catalogo/index.html',
            '/admin/support': '/src/pages/admin/support/index.html',
            '/404': '/src/pages/404/index.html'
          }

          // Check for exact match first
          const urlWithoutQuery = req.url.split('?')[0]
          if (rewrites[urlWithoutQuery]) {
            req.url = rewrites[urlWithoutQuery] + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '')
          }
          // Handle /c/:slug routes
          else if (req.url.startsWith('/c/') && !req.url.includes('.')) {
            // Check if it is a links page request: /c/:slug/links
            if (req.url.endsWith('/links')) {
              req.url = '/src/pages/links/index.html'
            } else {
              req.url = '/src/pages/catalog/index.html'
            }
          }
          // Handle /l/:slug routes (Centro de Enlaces pública)
          else if (req.url.startsWith('/l/') && !req.url.includes('.')) {
            req.url = '/src/pages/links/index.html'
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
            '/admin/dashboard': '/admin-dashboard.html',
            '/admin/users': '/admin-users.html',
            '/admin/businesses': '/admin-businesses.html',
            '/admin/business-detail': '/admin-business-detail.html',
            '/admin/setup-catalogo': '/admin-setup-catalogo.html',
            '/admin/support': '/admin-support.html',
            '/404': '/404.html'
          }

          // Check for exact match first
          if (rewrites[req.url]) {
            req.url = rewrites[req.url]
          }
          // Handle /c/:slug routes
          else if (req.url.startsWith('/c/') && !req.url.includes('.')) {
            if (req.url.endsWith('/links')) {
              req.url = '/links.html'
            } else {
              req.url = '/catalog.html'
            }
          }
          // Handle /l/:slug routes (Centro de Enlaces pública)
          else if (req.url.startsWith('/l/') && !req.url.includes('.')) {
            req.url = '/links.html'
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
          moveFile(resolve(srcDir, 'admin/dashboard/index.html'), resolve(distDir, 'admin-dashboard.html'))
          moveFile(resolve(srcDir, 'admin/users/index.html'), resolve(distDir, 'admin-users.html'))
          moveFile(resolve(srcDir, 'admin/businesses/index.html'), resolve(distDir, 'admin-businesses.html'))
          moveFile(resolve(srcDir, 'admin/business-detail/index.html'), resolve(distDir, 'admin-business-detail.html'))
          moveFile(resolve(srcDir, 'admin/setup-catalogo/index.html'), resolve(distDir, 'admin-setup-catalogo.html'))

          moveFile(resolve(srcDir, 'admin/support/index.html'), resolve(distDir, 'admin-support.html'))
          moveFile(resolve(srcDir, 'links/index.html'), resolve(distDir, 'links.html'))
          moveFile(resolve(srcDir, '404/index.html'), resolve(distDir, '404.html'))

          // Optional: Clean up src directory in dist if empty or no longer needed
          // fs.rmSync(resolve(distDir, 'src'), { recursive: true, force: true });
        }
      }
    }
  ]
})