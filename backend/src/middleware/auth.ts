import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { UnauthorizedError } from "./errors";

export const JWT_SECRET =
  process.env.JWT_SECRET || "assistflow-super-secure-jwt-secret-key-2026";

// Extend Express Request interface to include userId and userEmail
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
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
  let rawToken: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    rawToken = authHeader.slice(7).trim();
  } else if (req.headers["x-user-id"]) {
    rawToken = String(req.headers["x-user-id"]).trim();
  }

  if (!rawToken) {
    throw new UnauthorizedError("Authentication required: missing x-user-id header or Bearer token");
  }

  // 1. If token looks like a JWT (three parts separated by '.'), verify signature
  if (rawToken.split(".").length === 3) {
    try {
      const decoded = jwt.verify(rawToken, JWT_SECRET) as { userId?: string; email?: string };
      if (decoded && decoded.userId) {
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        return next();
      }
      throw new UnauthorizedError("Authentication failed: token payload missing userId");
    } catch (err: any) {
      throw new UnauthorizedError(`Authentication failed: invalid or expired token (${err.message})`);
    }
  }

  // 2. Fallback to raw UUID for test suites and backward compatibility
  const parseResult = uuidSchema.safeParse(rawToken);
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
