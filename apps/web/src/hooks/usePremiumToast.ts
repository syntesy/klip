"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export interface PremiumToast {
  id: string;
  title: string;
  price: number;
  communityId: string;
  premiumKlipId: string;
}

/** Listens for `premium:new` events on the user's personal socket room. */
export function usePremiumToast(getToken: (() => Promise<string | null>) | undefined) {
  const [toasts, setToasts] = useState<PremiumToast[]>([]);
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_API_URL) return;

    let active = true;

    async function connect() {
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      if (!active) return;

      const socket = io(process.env.NEXT_PUBLIC_API_URL!, { auth: { token } });

      socket.on("premium:new", (payload) => {
        const toast: PremiumToast = {
          id: `${payload.premiumKlipId}-${Date.now()}`,
          title: payload.title,
          price: payload.price,
          communityId: payload.communityId,
          premiumKlipId: payload.premiumKlipId,
        };
        setToasts((prev) => [...prev, toast]);
        // Auto-dismiss after 6 s
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 6000);
      });

      return () => { socket.disconnect(); };
    }

    const cleanup = connect();

    return () => {
      active = false;
      void cleanup.then((fn) => fn?.());
    };
  }, []); // Only once on mount

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, dismiss };
}
