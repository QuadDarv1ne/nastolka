import type { MetadataRoute } from "next"

/**
 * sitemap.xml — для поисковых систем (Google, Yandex, Bing).
 * Закрывает 404 на /sitemap.xml, который появится в логах после деплоя.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://nastolka.space-z.ai"
  const lastModified = new Date()
  return [
    {
      url: base,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/admin`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ]
}
