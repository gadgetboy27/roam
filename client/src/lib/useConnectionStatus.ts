import { useState, useEffect } from "react";
import { getSocket } from "./socket";

export type ConnectionState = "online" | "offline" | "connecting";

export function useConnectionStatus(): ConnectionState {
  const [online, setOnline] = useState(navigator.onLine);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => { setOnline(false); setSocketConnected(false); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const socket = getSocket();
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) setSocketConnected(true);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  if (!online) return "offline";
  if (!socketConnected) return "connecting";
  return "online";
}
