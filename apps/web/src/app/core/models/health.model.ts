export interface HealthStatus {
  status: 'ok';
  timestamp: string;
  services: {
    api: 'up';
    database: 'up';
  };
}
