import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: 'tests/streamlit', timeout: 120000, workers: 1, reporter: 'list',
  use: {
    baseURL: process.env.HARVESTSHIELD_STREAMLIT_URL ?? 'http://127.0.0.1:8501',
    viewport: {width: 1600, height: 1000}, headless: true,
    launchOptions: {executablePath: process.env.HARVESTSHIELD_CHROMIUM,
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']},
    trace: 'retain-on-failure',
  },
});
