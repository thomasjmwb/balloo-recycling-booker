import { renderBookingPage } from "./pages/booking.js";
import { renderSettingsPage } from "./pages/settings.js";

type Page = "booking" | "settings";
let currentPage: Page = "booking";

export function renderApp(container: HTMLElement): void {
  container.innerHTML = `
    <div class="app">
      <nav class="nav">
        <button class="nav-btn" data-page="booking">Book</button>
        <button class="nav-btn" data-page="settings">Settings</button>
      </nav>
      <main id="page-content"></main>
    </div>
  `;

  // Navigation
  container.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = (btn as HTMLButtonElement).dataset.page as Page;
      navigateTo(page);
    });
  });

  // Initial render
  renderPage();
}

function navigateTo(page: Page): void {
  currentPage = page;
  renderPage();
  updateNavState();
}

async function renderPage(): Promise<void> {
  const content = document.getElementById("page-content");
  if (!content) return;

  switch (currentPage) {
    case "booking":
      await renderBookingPage(content);
      break;
    case "settings":
      await renderSettingsPage(content);
      break;
  }
}

function updateNavState(): void {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const page = (btn as HTMLButtonElement).dataset.page;
    btn.classList.toggle("active", page === currentPage);
  });
}
