import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      'modules/api_url': path.resolve(__dirname, 'app/javascript/modules/api_url.js'),
      'modules/query_template': path.resolve(__dirname, 'app/javascript/modules/query_template.js'),
      'modules/search_executor': path.resolve(__dirname, 'app/javascript/modules/search_executor.js'),
      'modules/scorer': path.resolve(__dirname, 'app/javascript/modules/scorer.js'),
      'modules/ratings_store': path.resolve(__dirname, 'app/javascript/modules/ratings_store.js'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/javascript/**/*.test.js'],
  },
})
