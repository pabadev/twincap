"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "../i18n/client";

function subscribeToConnection(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

function getConnectionSnapshot() {
  return navigator.onLine;
}

function getServerConnectionSnapshot() {
  return true;
}

export function ConnectivityNotice() {
  const isOnline = useSyncExternalStore(
    subscribeToConnection,
    getConnectionSnapshot,
    getServerConnectionSnapshot,
  );
  const [connectionRestored, setConnectionRestored] = useState(false);
  const t = useT("Common");

  useEffect(() => {
    let restoredTimer: ReturnType<typeof setTimeout> | undefined;
    const handleOffline = () => setConnectionRestored(false);
    const handleOnline = () => {
      setConnectionRestored(true);
      if (restoredTimer) clearTimeout(restoredTimer);
      restoredTimer = setTimeout(() => setConnectionRestored(false), 4000);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (restoredTimer) clearTimeout(restoredTimer);
    };
  }, []);

  if (isOnline && !connectionRestored) return null;

  const isOffline = !isOnline;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`mb-4 rounded-md border px-3 py-2 text-sm ${
        isOffline
          ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          : "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
      }`}
    >
      {isOffline ? t("offline") : t("connectionRestored")}
    </div>
  );
}
