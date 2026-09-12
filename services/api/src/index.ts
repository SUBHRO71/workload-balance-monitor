import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

// Fail closed until authentication, authorization and consent are implemented.
// No API route or deployment is configured by this scaffold.
export const handler: APIGatewayProxyHandlerV2 = async () => ({
  statusCode: 503,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify({ code: "NOT_CONFIGURED", message: "Service setup is incomplete." }),
});
