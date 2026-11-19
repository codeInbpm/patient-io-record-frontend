import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [
    {
      name: 'fix-vue-demi-has-injection-context',
      enforce: 'pre',
      transform(code, id) {
        if (id.includes('vue-demi') && (id.endsWith('index.mjs') || id.endsWith('index.cjs'))) {
          if (!code.includes('hasInjectionContext')) {
            return code + '\nexport const hasInjectionContext = () => !!Vue.getCurrentInstance();\n'
          }
        }
        return null
      }
    },
    uni()
  ],
  build: {
    emptyOutDir: false
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
