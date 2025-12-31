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
  }
})