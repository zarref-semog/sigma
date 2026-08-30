export type LiveAgvStatus =
  | "Disponível"
  | "Executando missão"
  | "Em carga"
  | "Offline";

export type LiveAgv = {
  id: string;
  name?: string;
  x: number;
  y: number;
  status: LiveAgvStatus;
  battery: number;
};

export const AGV_STATUS_COLORS: Record<LiveAgvStatus, string> = {
  Disponível: "#16A34A",
  "Executando missão": "#2563EB",
  "Em carga": "#F59E0B",
  Offline: "#DC2626",
};
