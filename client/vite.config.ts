import { defineConfig } from "vite";
import { writeFileSync } from "fs";
import { resolve } from "path";

const buildId = new Date()
  .toISOString()
  .replace(/[-:T]/g, "")
  .slice(0, 12);

const SW_TEMPLATE = `// Auto-generated — do not edit. Build: ${buildId}
const CACHE_NAME = "recycling-booker-${buildId}";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (event.request.method === "GET" && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
`;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildId),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  plugins: [
    {
      name: "generate-sw",
      writeBundle() {
        writeFileSync(resolve(__dirname, "dist/sw.js"), SW_TEMPLATE);
      },
    },
  ],
});
