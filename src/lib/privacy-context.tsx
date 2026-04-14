"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface PrivacyContextValue {
  privacyMode: boolean;
  togglePrivacy: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  privacyMode: false,
  togglePrivacy: () => {},
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("privacy-mode");
    if (stored === "true") setPrivacyMode(true);
  }, []);

  function togglePrivacy() {
    setPrivacyMode((prev) => {
      const next = !prev;
      localStorage.setItem("privacy-mode", String(next));
      return next;
    });
  }

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
