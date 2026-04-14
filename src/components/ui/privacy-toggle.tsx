"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrivacy } from "@/lib/privacy-context";

export function PrivacyToggle() {
  const { privacyMode, togglePrivacy } = usePrivacy();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={togglePrivacy}
      title={privacyMode ? "Disable privacy mode" : "Enable privacy mode"}
    >
      {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
}
