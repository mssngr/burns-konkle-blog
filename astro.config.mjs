// @ts-check

import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Cantarell',
      cssVariable: '--font-cantarell',
    },
    {
      provider: fontProviders.google(),
      name: 'The Nautigal',
      cssVariable: '--font-the-nautigal',
    },
  ],
})
