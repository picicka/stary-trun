import { defineConfig } from 'vite'

// Základní adresa: lokálně kořen, na GitHub Pages podsložka s názvem repozitáře (nastavuje ji workflow).
// __BUILD__ = číslo sestavení; síťová hra jím ověřuje, že mají všichni hráči stejnou verzi.
export default defineConfig({ base: process.env.BASE_PATH ?? '/', define: { __BUILD__: JSON.stringify(Date.now().toString(36)) } })
