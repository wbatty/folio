"use client";

import { usePrivacy } from "@/lib/privacy-context";

const blurStyle: React.CSSProperties = {
  filter: "blur(4px)",
  userSelect: "none",
  pointerEvents: "none",
};

export function PrivacyBlur({ children, className }: { children: React.ReactNode; className?: string }) {
  const { privacyMode } = usePrivacy();
  return (
    <span className={className} style={privacyMode ? blurStyle : undefined}>
      {children}
    </span>
  );
}
