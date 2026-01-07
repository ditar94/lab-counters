import { Request, Response, NextFunction } from 'express';
import type { User, UserRole } from '@lab-counters/shared';
declare global {
    namespace Express {
        interface Request {
            user?: User;
            cognitoSub?: string;
        }
    }
}
export declare function authenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function authorize(...allowedRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function enforceOrgScope(req: Request, res: Response, next: NextFunction): void;
/**
 * Check if a user is a superadmin
 */
export declare function isSuperadmin(user: User | undefined): boolean;
/**
 * Middleware to restrict access to superadmins only
 */
export declare function superadminOnly(req: Request, res: Response, next: NextFunction): void;
/**
 * Helper to get org filter based on user role
 * Superadmins get no filter, others get their orgId
 */
export declare function getOrgFilter(user: User): {
    orgId?: string;
};
