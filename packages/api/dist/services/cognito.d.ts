export interface CreateCognitoUserOptions {
    username: string;
    email: string;
    name: string;
    temporaryPassword?: string;
    suppressEmail?: boolean;
}
export interface CognitoUserResult {
    cognitoId: string;
    username: string;
}
/**
 * Create a new user in Cognito
 * - If temporaryPassword provided and suppressEmail is true, uses that password and doesn't send email
 * - Otherwise, auto-generates a temporary password and sends invitation email
 * - User must change password on first login
 */
export declare function createCognitoUser(options: CreateCognitoUserOptions): Promise<CognitoUserResult>;
/**
 * Get a Cognito user by username
 */
export declare function getCognitoUser(username: string): Promise<{
    cognitoId: string;
    status: string;
} | null>;
/**
 * Disable a Cognito user (prevents login but doesn't delete)
 */
export declare function disableCognitoUser(username: string): Promise<void>;
/**
 * Enable a previously disabled Cognito user
 */
export declare function enableCognitoUser(username: string): Promise<void>;
/**
 * Delete a Cognito user completely
 */
export declare function deleteCognitoUser(username: string): Promise<void>;
/**
 * Reset a user's password.
 * - If temporaryPassword is provided, set it as a temporary password (forces change on login).
 * - Otherwise, Cognito sends the standard reset email.
 */
export declare function resetCognitoUserPassword(username: string, temporaryPassword?: string): Promise<void>;
/**
 * List all users in Cognito user pool
 */
export interface CognitoUserInfo {
    cognitoId: string;
    username: string;
    email: string;
    name: string;
    status: string;
    createdAt: Date;
}
export declare function listCognitoUsers(): Promise<CognitoUserInfo[]>;
/**
 * Custom error class for Cognito-related errors
 */
export declare class CognitoError extends Error {
    code: string;
    constructor(code: string, message: string);
}
