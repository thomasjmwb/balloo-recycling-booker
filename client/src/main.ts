import "./styles.css";
import { renderApp } from "./app.js";

// Register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.log("SW registration failed:", err);
    });
  });
}

// Render app
const app = document.getElementById("app");
if (app) {
  renderApp(app);
}
