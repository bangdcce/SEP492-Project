import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";

type CurrentUserShape = object;

const readCurrentUser = <T extends CurrentUserShape>() =>
  getStoredJson<T>(STORAGE_KEYS.USER);

export function useCurrentUser<T extends CurrentUserShape>() {
  const [user, setUser] = useState<T | null>(() => readCurrentUser<T>());

  const syncUser = useCallback(() => {
    setUser(readCurrentUser<T>());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === STORAGE_KEYS.USER) {
        syncUser();
      }
    };

    syncUser();
    window.addEventListener("userDataUpdated", syncUser);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("userDataUpdated", syncUser);
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncUser]);

  return user;
}
