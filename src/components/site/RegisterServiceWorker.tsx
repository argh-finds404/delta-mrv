"use client";

import * as React from "react";

/** docs/16 A11: registers public/sw.js, which caches one static offline page. Production only. */
export function RegisterServiceWorker() {
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
