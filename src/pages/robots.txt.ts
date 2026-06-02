import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('/sitemap.xml', site).toString();

  return new Response(`User-agent: *
Allow: /

Sitemap: ${sitemap}
`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
