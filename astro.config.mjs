// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://transnavi.jp',
  redirects: {
    // Legacy /articles/ section was merged into the topic pages below.
    '/articles': '/learn',
    '/articles/cultural-works': '/works',
    '/articles/start-here': '/start',
    '/articles/editorial-policy': '/about',
    '/articles/international-resources': '/resources',
  },
  devToolbar: {
    enabled: false,
  },
});
