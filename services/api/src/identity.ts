import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { callerFromJwtClaims, type CallerIdentity } from "@workload/backend-core";

export function callerFromEvent(event: APIGatewayProxyEventV2WithJWTAuthorizer): CallerIdentity {
  return callerFromJwtClaims(event.requestContext.authorizer.jwt.claims);
}
