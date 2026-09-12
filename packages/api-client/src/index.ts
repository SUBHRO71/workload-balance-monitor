// Transport will be implemented after authentication and API contracts are established.
export interface ApiClientConfiguration {
  baseUrl: string;
  getAccessToken: () => Promise<string>;
}
