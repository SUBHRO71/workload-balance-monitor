import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { callerFromEvent } from "./identity";
import { json } from "./http";

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  callerFromEvent(event);
  return json(503, { code: "NOT_IMPLEMENTED", message: "Administration APIs begin in a later phase." });
};
