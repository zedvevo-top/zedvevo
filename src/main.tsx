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
        reason.includes("JWT issued at future") ||
        reason.includes("PGRST303") ||
        reason.includes("JWT expired"))
    ) {
      event.preventDefault();
      console.warn("Handled auth / clock skew token notice gracefully:", reason);
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card border border-border p-6 rounded-3xl text-center shadow-xl space-y-4">
        <h2 className="text-lg font-black text-white">ZedVevo System Notice</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your session was refreshed or signed out. Please return to home or sign in to continue enjoying ZedVevo.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <a href="/" className="px-4 py-2 bg-accent text-accent-foreground rounded-xl font-bold text-xs hover:bg-accent/90 transition-colors">
            Home
          </a>
          <a href="/login" className="px-4 py-2 bg-muted text-foreground rounded-xl font-bold text-xs hover:bg-muted/80 transition-colors">
            Sign In
          </a>
        </div>
      </div>
    </div>
  }>
    <AppWrapper>
      <App />
    </AppWrapper>
  </Sentry.ErrorBoundary>
);
