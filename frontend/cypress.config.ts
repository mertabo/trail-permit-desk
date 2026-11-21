import { defineConfig } from 'cypress'

export default defineConfig({
  component: {
    specPattern: 'src/**/__tests__/*.cy.ts',
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
  },
})
