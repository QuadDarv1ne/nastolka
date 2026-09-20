import type { NextConfig } from "next";

// Порт мини-сервиса мультиплеера (должен совпадать с MP_PORT в mini-services/nastolka-multiplayer)
const MP_PORT = process.env.MP_PORT || "3003";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  // Проверка типов при сборке включена: tsc --noEmit проходит чисто
  // (ошибки типов устранены 20.09.2026).
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // Без этой опции Next делает 308-редирект /mp/ → /mp ещё до применения
  // rewrites, и handshake socket.io (он ходит в `${path}/`) ломается.
  skipTrailingSlashRedirect: true,
  // Разрешаем dev-запросы с превью-доменов (для облачных деплоев: Amvera, space-z.ai и т.п.)
  allowedDevOrigins: [
    "https://preview-chat-db4afbe9-30bd-4b68-8a32-24f437dff00a.space-z.ai",
    "*.space-z.ai",
  ],
  // Проксируем socket.io-трафик на мини-сервис (порт 3003) через сам Next.
  // Это даёт мультиплееру тот же origin, что и у сайта: работает и по
  // localhost, и по LAN-IP, и по HTTPS-превью-домену — без отдельного порта
  // и без mixed-content блокировок браузера.
  async rewrites() {
    const base = `http://127.0.0.1:${MP_PORT}/mp`;
    return [
      // Handshake socket.io идёт ровно в `${path}/` (пустой sid). Next не
      // матчит такой запрос правилом `/mp/:path*` (пустой wildcard), поэтому
      // корень пути прописываем явно — иначе handshake получает 404.
      { source: "/mp/", destination: `${base}/` },
      { source: "/mp", destination: `${base}/` },
      // Все остальные запросы: /mp/<sid>?sid=… (polling) и т.п.
      { source: "/mp/:path*", destination: `${base}/:path*` },
    ];
  },
};

export default nextConfig;
