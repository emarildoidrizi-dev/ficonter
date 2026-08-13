export type HealthStatus = "healthy" | "degraded" | "offline";

export type HealthServiceKey =
  | "auth"
  | "database"
  | "storage"
  | "realtime";

export type HealthCheck = {
  status: HealthStatus;
  latencyMs: number | null;
  checkedAt: string;
  message: string;
};

export type PlatformHealthSnapshot = {
  checkedAt: string;
  services: Record<HealthServiceKey, HealthCheck>;
};
