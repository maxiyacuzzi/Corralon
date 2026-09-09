import { defineConfig } from 'cypress';
import mochawesomeReporterPlugin from 'cypress-mochawesome-reporter/plugin.js';

export default defineConfig({
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    reportDir: 'cypress/reports',
    reportPageTitle: 'Corralón — resultados E2E',
    charts: true,
    embeddedScreenshots: true,
    inlineAssets: true,
    overwrite: true,
  },
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    video: false,
    retries: {
      runMode: 1,
      openMode: 0,
    },
    setupNodeEvents(on) {
      mochawesomeReporterPlugin(on);
    },
  },
});
