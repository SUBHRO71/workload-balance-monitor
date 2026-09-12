import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { json } from "./http";

export const handler: APIGatewayProxyHandlerV2 = async () => json(200, { status: "ok", service: "workload-monitor-api" });
