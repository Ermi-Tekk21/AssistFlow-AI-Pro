import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "./errors";

export function authenticateWorkflow(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const configuredSecret =
    process.env.N8N_WORKFLOW_SECRET ?? process.env.WORKFLOW_SECRET;

  if (!configuredSecret) {
    // If no secret configured, fail-safe closed
    throw new UnauthorizedError("Workflow endpoint is disabled: missing N8N_WORKFLOW_SECRET");
  }

  const providedSecret =
    req.headers["x-workflow-secret"] ??
    (req.headers["authorization"]?.startsWith("Bearer ")
      ? req.headers["authorization"].slice(7).trim()
      : undefined);

  if (!providedSecret || providedSecret !== configuredSecret) {
    throw new UnauthorizedError("Unauthorized workflow request: invalid or missing workflow secret");
  }

  next();
}
