import { PORT } from "./config/env.js";
import { app } from "./app.js";

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
