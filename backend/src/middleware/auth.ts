import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { UnauthorizedError } from "./errors";

// Extend Express Request interface to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const uuidSchema = z.string().uuid();

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  let rawUserId: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    rawUserId = authHeader.slice(7).trim();
  } else if (req.headers["x-user-id"]) {
    rawUserId = String(req.headers["x-user-id"]).trim();
  }

  if (!rawUserId) {
    throw new UnauthorizedError("Authentication required: missing x-user-id header or Bearer token");
  }

  const parseResult = uuidSchema.safeParse(rawUserId);
  if (!parseResult.success) {
    throw new UnauthorizedError("Authentication failed: invalid user ID format");
  }

  req.userId = parseResult.data;
  next();
}

export function getAuthenticatedUserId(req: Request): string {
  if (!req.userId) {
    throw new UnauthorizedError("User is not authenticated");
  }
  return req.userId;
}
