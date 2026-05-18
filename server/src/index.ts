import { PORT } from "./config/env.js";
import { app } from "./app.js";
import { ensureRouterDns } from "./routerDns.js";

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  ensureRouterDns().catch((err) => {
    console.error("[router-dns] unexpected error:", err);
  });
});
