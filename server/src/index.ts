import { PORT } from "./config/env.js";
import { app } from "./app.js";
import { startRouterDnsWatchdog } from "./routerDns.js";

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startRouterDnsWatchdog();
});
