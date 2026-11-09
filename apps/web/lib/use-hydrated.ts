"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during the server render and hydration, true after: for text that depends on the viewer's time zone. */
export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
