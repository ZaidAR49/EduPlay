import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/contact', '/privacy', '/terms', '/policies'],
      disallow: ['/admin', '/dashboard', '/api', '/auth-error', '/blocked', '/unauthorized'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
