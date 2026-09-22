import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
});

// Handle invalid or missing refresh token errors globally without crashing or showing error overlays
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason?.message || event.reason;
    if (
      typeof reason === "string" &&
      (reason.includes("Invalid Refresh Token") ||
        reason.includes("Refresh Token Not Found") ||
        reason.includes("JWT expired"))
    ) {
      event.preventDefault();
      console.warn("Cleared invalid refresh token session.");
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>应用发生错误，请刷新页面重试</p>}>
    <AppWrapper>
      <App />
    </AppWrapper>
  </Sentry.ErrorBoundary>
);
