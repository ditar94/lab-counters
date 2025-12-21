import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error safely (ZodError objects can crash console.error)
  if (err instanceof ZodError) {
    console.error('Validation Error:', JSON.stringify(err.errors, null, 2));
  } else {
    console.error('Error:', err.message, err.stack);
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const path = e.path.join('.');
      if (!details[path]) details[path] = [];
      details[path].push(e.message);
    });

    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details,
    });
    return;
  }

  // Custom application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as unknown as { code: string; meta?: { target?: string[] } };

    if (prismaError.code === 'P2002') {
      res.status(409).json({
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this value already exists',
        details: { fields: prismaError.meta?.target || [] },
      });
      return;
    }

    if (prismaError.code === 'P2025') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Record not found',
      });
      return;
    }
  }

  // Default error
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
}
