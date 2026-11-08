"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n/client";
import { Button } from "./ui/button";

export function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const updateAcceptedRef = useRef(false);
  const t = useT("Common");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Development: purge any service worker / cache left over from a
      // previous session. Serving stale JS chunks against fresh SSR HTML
      // produces phantom hydration mismatches.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        });
      }
      return;
    }

    let registration: ServiceWorkerRegistration | undefined;
    let updateCheck: ReturnType<typeof setInterval> | undefined;

    const checkForUpdate = () => {
      if (document.visibilityState === "visible") {
        void registration?.update().catch(() => {
          // Keep the current app available if the network is temporarily unavailable.
        });
      }
    };

    const showWaitingWorker = (worker?: ServiceWorker | null) => {
      const waiting = worker ?? registration?.waiting;
      if (waiting && registration?.active) {
        waitingWorkerRef.current = waiting;
        setUpdateReady(true);
      }
    };

    const handleControllerChange = () => {
      // The first install also changes controller. Reload only after the user
      // accepted an update and the waiting worker took control.
      if (updateAcceptedRef.current) window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((serviceWorkerRegistration) => {
        registration = serviceWorkerRegistration;
        showWaitingWorker();

        registration.addEventListener("updatefound", () => {
          const installing = registration?.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed") showWaitingWorker(installing);
          });
        });

        checkForUpdate();
        updateCheck = setInterval(checkForUpdate, 6 * 60 * 60 * 1000);
      })
      .catch(() => {
        // Service worker registration failed silently.
      });

    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("online", checkForUpdate);

    return () => {
      if (updateCheck) clearInterval(updateCheck);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-primary/30 bg-surface-card p-3 text-sm text-zinc-900 shadow-xl dark:text-white"
    >
      <span>{t("appUpdateAvailable")}</span>
      <Button
        size="sm"
        onClick={() => {
          updateAcceptedRef.current = true;
          waitingWorkerRef.current?.postMessage({ type: "SKIP_WAITING" });
        }}
      >
        {t("appUpdateReload")}
      </Button>
    </div>
  );
}
