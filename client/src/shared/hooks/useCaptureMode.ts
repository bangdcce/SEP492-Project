import { useMemo } from "react";
import { useLocation } from "react-router-dom";

const ENABLED_VALUES = new Set(["", "1", "true", "yes", "on"]);

export function useCaptureMode() {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const rawValue = params.get("capture");

    if (rawValue === null) {
      return false;
    }

    return ENABLED_VALUES.has(rawValue.trim().toLowerCase());
  }, [location.search]);
}
