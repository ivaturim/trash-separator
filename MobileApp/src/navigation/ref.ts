import { createNavigationContainerRef } from "@react-navigation/native";
import { useEffect, useState } from "react";

import type { RootStackParamList } from "./types";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Safe outside a navigator — VoiceFab sits beside the stack, not inside it. */
export function useCurrentRouteName(): keyof RootStackParamList | undefined {
  const [name, setName] = useState<keyof RootStackParamList | undefined>();

  useEffect(() => {
    function sync() {
      if (!navigationRef.isReady()) return;
      setName(navigationRef.getCurrentRoute()?.name as keyof RootStackParamList);
    }

    sync();
    const unsubscribe = navigationRef.addListener("state", sync);
    return unsubscribe;
  }, []);

  return name;
}

export function navigate<Name extends keyof RootStackParamList>(
  ...args: undefined extends RootStackParamList[Name]
    ? [Name] | [Name, RootStackParamList[Name]]
    : [Name, RootStackParamList[Name]]
) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(...(args as never));
}
