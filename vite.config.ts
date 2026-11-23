import { defineConfig } from 'vite'

// Základní adresa: lokálně kořen, na GitHub Pages podsložka s názvem repozitáře (nastavuje ji workflow).
export default defineConfig({ base: process.env.BASE_PATH ?? '/' })
