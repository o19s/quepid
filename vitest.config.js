/**
 * Vitest configuration for Quepid JavaScript tests.
 *
 * Replaces Karma/Jasmine. Supports ES modules natively; no build step required
 * for tests. Path aliases mirror config/importmap.rb for consistent resolution.
 */

import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
  test: {
    include: ['spec/javascripts/**/*_spec.js', 'spec/javascripts/**/*.test.js'],
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      modules: path.resolve(__dirname, 'app/javascript/modules'),
      utils: path.resolve(__dirname, 'app/javascript/utils'),
      api: path.resolve(__dirname, 'app/javascript/api'),
      controllers: path.resolve(__dirname, 'app/javascript/controllers'),
    },
  },
}
