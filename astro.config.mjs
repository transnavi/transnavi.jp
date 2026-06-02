// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://transnavi.jp',
  redirects: {
    '/articles/cultural-works': '/works',
  },
  devToolbar: {
    enabled: false,
  },
});
