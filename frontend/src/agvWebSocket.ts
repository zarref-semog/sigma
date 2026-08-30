import type { LiveAgv } from "./agvStatus";

type Telemetry = { projectId: string; agv: LiveAgv };

export function connectAgvWebSocket(
  projectId: string,
  onUpdate: (agvs: LiveAgv[]) => void,
  onEvent?: (event: {
    type: string;
    projectId?: string;
    missionId?: string;
  }) => void,
) {
  let socket: WebSocket | null = null;
  let retry: number | undefined;
  let closed = false;
  const latest = new Map<string, LiveAgv>();

  const connect = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = encodeURIComponent(localStorage.getItem("sigma_token") || "");
    socket = new WebSocket(
      `${protocol}//${window.location.host}/ws/agvs?token=${token}`,
    );
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type !== "AGV_TELEMETRY" && message.type !== "AGV_SNAPSHOT") {
        if (!message.projectId || message.projectId === projectId)
          onEvent?.(message);
        return;
      }
      const items: Telemetry[] =
        message.type === "AGV_SNAPSHOT" ? message.items : [message];
      for (const telemetry of items) {
        if (telemetry.projectId === projectId)
          latest.set(telemetry.agv.id, telemetry.agv);
      }
      onUpdate([...latest.values()]);
    };
    socket.onclose = () => {
      if (!closed) retry = window.setTimeout(connect, 1500);
    };
  };

  connect();
  return {
    close() {
      closed = true;
      if (retry) window.clearTimeout(retry);
      socket?.close();
    },
  };
}
