import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    statusCode: number;
    code: string;
    details?: Record<string, string[]> | undefined;
    constructor(statusCode: number, code: string, message: string, details?: Record<string, string[]> | undefined);
}
export declare function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void;
