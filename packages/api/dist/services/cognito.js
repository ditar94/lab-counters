"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CognitoError = void 0;
exports.createCognitoUser = createCognitoUser;
exports.getCognitoUser = getCognitoUser;
exports.disableCognitoUser = disableCognitoUser;
exports.enableCognitoUser = enableCognitoUser;
exports.deleteCognitoUser = deleteCognitoUser;
exports.resetCognitoUserPassword = resetCognitoUserPassword;
exports.listCognitoUsers = listCognitoUsers;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-2',
});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
/**
 * Create a new user in Cognito
 * - If temporaryPassword provided and suppressEmail is true, uses that password and doesn't send email
 * - Otherwise, auto-generates a temporary password and sends invitation email
 * - User must change password on first login
 */
async function createCognitoUser(options) {
    const { username, email, name, temporaryPassword, suppressEmail } = options;
    try {
        const command = new client_cognito_identity_provider_1.AdminCreateUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'email_verified', Value: 'true' },
                { Name: 'name', Value: name },
            ],
            // If suppressing email, use provided temp password; otherwise let Cognito email it
            ...(suppressEmail && temporaryPassword
                ? {
                    TemporaryPassword: temporaryPassword,
                    MessageAction: 'SUPPRESS',
                }
                : {
                    DesiredDeliveryMediums: ['EMAIL'],
                }),
            ForceAliasCreation: false,
        });
        const result = await client.send(command);
        if (!result.User?.Username) {
            throw new Error('Failed to create Cognito user - no username returned');
        }
        // The 'sub' attribute contains the unique Cognito user ID
        const subAttribute = result.User.Attributes?.find((attr) => attr.Name === 'sub');
        if (!subAttribute?.Value) {
            throw new Error('Failed to get Cognito user sub');
        }
        return {
            cognitoId: subAttribute.Value,
            username: result.User.Username,
        };
    }
    catch (error) {
        if (error instanceof client_cognito_identity_provider_1.UsernameExistsException) {
            throw new CognitoError('USERNAME_EXISTS', 'A user with this username already exists');
        }
        if (error instanceof client_cognito_identity_provider_1.InvalidParameterException) {
            throw new CognitoError('INVALID_PARAMETER', error.message);
        }
        throw error;
    }
}
/**
 * Get a Cognito user by username
 */
async function getCognitoUser(username) {
    try {
        const command = new client_cognito_identity_provider_1.AdminGetUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
        });
        const result = await client.send(command);
        const subAttribute = result.UserAttributes?.find((attr) => attr.Name === 'sub');
        return {
            cognitoId: subAttribute?.Value || '',
            status: result.UserStatus || 'UNKNOWN',
        };
    }
    catch (error) {
        if (error.name === 'UserNotFoundException') {
            return null;
        }
        throw error;
    }
}
/**
 * Disable a Cognito user (prevents login but doesn't delete)
 */
async function disableCognitoUser(username) {
    const command = new client_cognito_identity_provider_1.AdminDisableUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
    });
    await client.send(command);
}
/**
 * Enable a previously disabled Cognito user
 */
async function enableCognitoUser(username) {
    const command = new client_cognito_identity_provider_1.AdminEnableUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
    });
    await client.send(command);
}
/**
 * Delete a Cognito user completely
 */
async function deleteCognitoUser(username) {
    const command = new client_cognito_identity_provider_1.AdminDeleteUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
    });
    await client.send(command);
}
/**
 * Reset a user's password.
 * - If temporaryPassword is provided, set it as a temporary password (forces change on login).
 * - Otherwise, Cognito sends the standard reset email.
 */
async function resetCognitoUserPassword(username, temporaryPassword) {
    if (temporaryPassword) {
        const command = new client_cognito_identity_provider_1.AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            Password: temporaryPassword,
            Permanent: false,
        });
        await client.send(command);
        return;
    }
    const command = new client_cognito_identity_provider_1.AdminResetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
    });
    await client.send(command);
}
async function listCognitoUsers() {
    const users = [];
    let paginationToken;
    do {
        const command = new client_cognito_identity_provider_1.ListUsersCommand({
            UserPoolId: USER_POOL_ID,
            PaginationToken: paginationToken,
            Limit: 60, // Max allowed
        });
        const result = await client.send(command);
        for (const user of result.Users || []) {
            const getAttribute = (name) => user.Attributes?.find((attr) => attr.Name === name)?.Value || '';
            users.push({
                cognitoId: getAttribute('sub'),
                username: user.Username || '',
                email: getAttribute('email'),
                name: getAttribute('name'),
                status: user.UserStatus || 'UNKNOWN',
                createdAt: user.UserCreateDate || new Date(),
            });
        }
        paginationToken = result.PaginationToken;
    } while (paginationToken);
    return users;
}
/**
 * Custom error class for Cognito-related errors
 */
class CognitoError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'CognitoError';
    }
}
exports.CognitoError = CognitoError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29nbml0by5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2aWNlcy9jb2duaXRvLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQXVDQSw4Q0FzREM7QUFLRCx3Q0F1QkM7QUFLRCxnREFPQztBQUtELDhDQU9DO0FBS0QsOENBT0M7QUFPRCw0REFvQkM7QUFjRCw0Q0ErQkM7QUFyT0QsZ0dBWW1EO0FBRW5ELE1BQU0sTUFBTSxHQUFHLElBQUksZ0VBQTZCLENBQUM7SUFDL0MsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLFdBQVc7Q0FDOUMsQ0FBQyxDQUFDO0FBRUgsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBcUIsQ0FBQztBQWV2RDs7Ozs7R0FLRztBQUNJLEtBQUssVUFBVSxpQkFBaUIsQ0FDckMsT0FBaUM7SUFFakMsTUFBTSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFFLGFBQWEsRUFBRSxHQUFHLE9BQU8sQ0FBQztJQUU1RSxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBRyxJQUFJLHlEQUFzQixDQUFDO1lBQ3pDLFVBQVUsRUFBRSxZQUFZO1lBQ3hCLFFBQVEsRUFBRSxRQUFRO1lBQ2xCLGNBQWMsRUFBRTtnQkFDZCxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTtnQkFDL0IsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRTtnQkFDekMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7YUFDOUI7WUFDRCxtRkFBbUY7WUFDbkYsR0FBRyxDQUFDLGFBQWEsSUFBSSxpQkFBaUI7Z0JBQ3BDLENBQUMsQ0FBQztvQkFDRSxpQkFBaUIsRUFBRSxpQkFBaUI7b0JBQ3BDLGFBQWEsRUFBRSxVQUFtQjtpQkFDbkM7Z0JBQ0gsQ0FBQyxDQUFDO29CQUNFLHNCQUFzQixFQUFFLENBQUMsT0FBZ0IsQ0FBQztpQkFDM0MsQ0FBQztZQUNOLGtCQUFrQixFQUFFLEtBQUs7U0FDMUIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDO1lBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBRUQsMERBQTBEO1FBQzFELE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FDL0MsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUM5QixDQUFDO1FBRUYsSUFBSSxDQUFDLFlBQVksRUFBRSxLQUFLLEVBQUUsQ0FBQztZQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7UUFDcEQsQ0FBQztRQUVELE9BQU87WUFDTCxTQUFTLEVBQUUsWUFBWSxDQUFDLEtBQUs7WUFDN0IsUUFBUSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUTtTQUMvQixDQUFDO0lBQ0osQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixJQUFJLEtBQUssWUFBWSwwREFBdUIsRUFBRSxDQUFDO1lBQzdDLE1BQU0sSUFBSSxZQUFZLENBQUMsaUJBQWlCLEVBQUUsMENBQTBDLENBQUMsQ0FBQztRQUN4RixDQUFDO1FBQ0QsSUFBSSxLQUFLLFlBQVksNERBQXlCLEVBQUUsQ0FBQztZQUMvQyxNQUFNLElBQUksWUFBWSxDQUFDLG1CQUFtQixFQUFHLEtBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBQ0QsTUFBTSxLQUFLLENBQUM7SUFDZCxDQUFDO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0ksS0FBSyxVQUFVLGNBQWMsQ0FBQyxRQUFnQjtJQUNuRCxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBRyxJQUFJLHNEQUFtQixDQUFDO1lBQ3RDLFVBQVUsRUFBRSxZQUFZO1lBQ3hCLFFBQVEsRUFBRSxRQUFRO1NBQ25CLENBQUMsQ0FBQztRQUVILE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUUxQyxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsY0FBYyxFQUFFLElBQUksQ0FDOUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUM5QixDQUFDO1FBRUYsT0FBTztZQUNMLFNBQVMsRUFBRSxZQUFZLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDcEMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxVQUFVLElBQUksU0FBUztTQUN2QyxDQUFDO0lBQ0osQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixJQUFLLEtBQTJCLENBQUMsSUFBSSxLQUFLLHVCQUF1QixFQUFFLENBQUM7WUFDbEUsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsTUFBTSxLQUFLLENBQUM7SUFDZCxDQUFDO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0ksS0FBSyxVQUFVLGtCQUFrQixDQUFDLFFBQWdCO0lBQ3ZELE1BQU0sT0FBTyxHQUFHLElBQUksMERBQXVCLENBQUM7UUFDMUMsVUFBVSxFQUFFLFlBQVk7UUFDeEIsUUFBUSxFQUFFLFFBQVE7S0FDbkIsQ0FBQyxDQUFDO0lBRUgsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzdCLENBQUM7QUFFRDs7R0FFRztBQUNJLEtBQUssVUFBVSxpQkFBaUIsQ0FBQyxRQUFnQjtJQUN0RCxNQUFNLE9BQU8sR0FBRyxJQUFJLHlEQUFzQixDQUFDO1FBQ3pDLFVBQVUsRUFBRSxZQUFZO1FBQ3hCLFFBQVEsRUFBRSxRQUFRO0tBQ25CLENBQUMsQ0FBQztJQUVILE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM3QixDQUFDO0FBRUQ7O0dBRUc7QUFDSSxLQUFLLFVBQVUsaUJBQWlCLENBQUMsUUFBZ0I7SUFDdEQsTUFBTSxPQUFPLEdBQUcsSUFBSSx5REFBc0IsQ0FBQztRQUN6QyxVQUFVLEVBQUUsWUFBWTtRQUN4QixRQUFRLEVBQUUsUUFBUTtLQUNuQixDQUFDLENBQUM7SUFFSCxNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDN0IsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUsd0JBQXdCLENBQzVDLFFBQWdCLEVBQ2hCLGlCQUEwQjtJQUUxQixJQUFJLGlCQUFpQixFQUFFLENBQUM7UUFDdEIsTUFBTSxPQUFPLEdBQUcsSUFBSSw4REFBMkIsQ0FBQztZQUM5QyxVQUFVLEVBQUUsWUFBWTtZQUN4QixRQUFRLEVBQUUsUUFBUTtZQUNsQixRQUFRLEVBQUUsaUJBQWlCO1lBQzNCLFNBQVMsRUFBRSxLQUFLO1NBQ2pCLENBQUMsQ0FBQztRQUNILE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMzQixPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUFHLElBQUksZ0VBQTZCLENBQUM7UUFDaEQsVUFBVSxFQUFFLFlBQVk7UUFDeEIsUUFBUSxFQUFFLFFBQVE7S0FDbkIsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzdCLENBQUM7QUFjTSxLQUFLLFVBQVUsZ0JBQWdCO0lBQ3BDLE1BQU0sS0FBSyxHQUFzQixFQUFFLENBQUM7SUFDcEMsSUFBSSxlQUFtQyxDQUFDO0lBRXhDLEdBQUcsQ0FBQztRQUNGLE1BQU0sT0FBTyxHQUFHLElBQUksbURBQWdCLENBQUM7WUFDbkMsVUFBVSxFQUFFLFlBQVk7WUFDeEIsZUFBZSxFQUFFLGVBQWU7WUFDaEMsS0FBSyxFQUFFLEVBQUUsRUFBRSxjQUFjO1NBQzFCLENBQUMsQ0FBQztRQUVILE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUUxQyxLQUFLLE1BQU0sSUFBSSxJQUFJLE1BQU0sQ0FBQyxLQUFLLElBQUksRUFBRSxFQUFFLENBQUM7WUFDdEMsTUFBTSxZQUFZLEdBQUcsQ0FBQyxJQUFZLEVBQUUsRUFBRSxDQUNwQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDO1lBRW5FLEtBQUssQ0FBQyxJQUFJLENBQUM7Z0JBQ1QsU0FBUyxFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUM7Z0JBQzlCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxJQUFJLEVBQUU7Z0JBQzdCLEtBQUssRUFBRSxZQUFZLENBQUMsT0FBTyxDQUFDO2dCQUM1QixJQUFJLEVBQUUsWUFBWSxDQUFDLE1BQU0sQ0FBQztnQkFDMUIsTUFBTSxFQUFFLElBQUksQ0FBQyxVQUFVLElBQUksU0FBUztnQkFDcEMsU0FBUyxFQUFFLElBQUksQ0FBQyxjQUFjLElBQUksSUFBSSxJQUFJLEVBQUU7YUFDN0MsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELGVBQWUsR0FBRyxNQUFNLENBQUMsZUFBZSxDQUFDO0lBQzNDLENBQUMsUUFBUSxlQUFlLEVBQUU7SUFFMUIsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLFlBQWEsU0FBUSxLQUFLO0lBRTVCO0lBRFQsWUFDUyxJQUFZLEVBQ25CLE9BQWU7UUFFZixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFIUixTQUFJLEdBQUosSUFBSSxDQUFRO1FBSW5CLElBQUksQ0FBQyxJQUFJLEdBQUcsY0FBYyxDQUFDO0lBQzdCLENBQUM7Q0FDRjtBQVJELG9DQVFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ29nbml0b0lkZW50aXR5UHJvdmlkZXJDbGllbnQsXG4gIEFkbWluQ3JlYXRlVXNlckNvbW1hbmQsXG4gIEFkbWluRGlzYWJsZVVzZXJDb21tYW5kLFxuICBBZG1pbkVuYWJsZVVzZXJDb21tYW5kLFxuICBBZG1pbkRlbGV0ZVVzZXJDb21tYW5kLFxuICBBZG1pblJlc2V0VXNlclBhc3N3b3JkQ29tbWFuZCxcbiAgQWRtaW5TZXRVc2VyUGFzc3dvcmRDb21tYW5kLFxuICBBZG1pbkdldFVzZXJDb21tYW5kLFxuICBMaXN0VXNlcnNDb21tYW5kLFxuICBVc2VybmFtZUV4aXN0c0V4Y2VwdGlvbixcbiAgSW52YWxpZFBhcmFtZXRlckV4Y2VwdGlvbixcbn0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWNvZ25pdG8taWRlbnRpdHktcHJvdmlkZXInO1xuXG5jb25zdCBjbGllbnQgPSBuZXcgQ29nbml0b0lkZW50aXR5UHJvdmlkZXJDbGllbnQoe1xuICByZWdpb246IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfHwgJ3VzLWVhc3QtMicsXG59KTtcblxuY29uc3QgVVNFUl9QT09MX0lEID0gcHJvY2Vzcy5lbnYuQ09HTklUT19VU0VSX1BPT0xfSUQhO1xuXG5leHBvcnQgaW50ZXJmYWNlIENyZWF0ZUNvZ25pdG9Vc2VyT3B0aW9ucyB7XG4gIHVzZXJuYW1lOiBzdHJpbmc7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgdGVtcG9yYXJ5UGFzc3dvcmQ/OiBzdHJpbmc7XG4gIHN1cHByZXNzRW1haWw/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvZ25pdG9Vc2VyUmVzdWx0IHtcbiAgY29nbml0b0lkOiBzdHJpbmc7XG4gIHVzZXJuYW1lOiBzdHJpbmc7XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IHVzZXIgaW4gQ29nbml0b1xuICogLSBJZiB0ZW1wb3JhcnlQYXNzd29yZCBwcm92aWRlZCBhbmQgc3VwcHJlc3NFbWFpbCBpcyB0cnVlLCB1c2VzIHRoYXQgcGFzc3dvcmQgYW5kIGRvZXNuJ3Qgc2VuZCBlbWFpbFxuICogLSBPdGhlcndpc2UsIGF1dG8tZ2VuZXJhdGVzIGEgdGVtcG9yYXJ5IHBhc3N3b3JkIGFuZCBzZW5kcyBpbnZpdGF0aW9uIGVtYWlsXG4gKiAtIFVzZXIgbXVzdCBjaGFuZ2UgcGFzc3dvcmQgb24gZmlyc3QgbG9naW5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUNvZ25pdG9Vc2VyKFxuICBvcHRpb25zOiBDcmVhdGVDb2duaXRvVXNlck9wdGlvbnNcbik6IFByb21pc2U8Q29nbml0b1VzZXJSZXN1bHQ+IHtcbiAgY29uc3QgeyB1c2VybmFtZSwgZW1haWwsIG5hbWUsIHRlbXBvcmFyeVBhc3N3b3JkLCBzdXBwcmVzc0VtYWlsIH0gPSBvcHRpb25zO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBBZG1pbkNyZWF0ZVVzZXJDb21tYW5kKHtcbiAgICAgIFVzZXJQb29sSWQ6IFVTRVJfUE9PTF9JRCxcbiAgICAgIFVzZXJuYW1lOiB1c2VybmFtZSxcbiAgICAgIFVzZXJBdHRyaWJ1dGVzOiBbXG4gICAgICAgIHsgTmFtZTogJ2VtYWlsJywgVmFsdWU6IGVtYWlsIH0sXG4gICAgICAgIHsgTmFtZTogJ2VtYWlsX3ZlcmlmaWVkJywgVmFsdWU6ICd0cnVlJyB9LFxuICAgICAgICB7IE5hbWU6ICduYW1lJywgVmFsdWU6IG5hbWUgfSxcbiAgICAgIF0sXG4gICAgICAvLyBJZiBzdXBwcmVzc2luZyBlbWFpbCwgdXNlIHByb3ZpZGVkIHRlbXAgcGFzc3dvcmQ7IG90aGVyd2lzZSBsZXQgQ29nbml0byBlbWFpbCBpdFxuICAgICAgLi4uKHN1cHByZXNzRW1haWwgJiYgdGVtcG9yYXJ5UGFzc3dvcmRcbiAgICAgICAgPyB7XG4gICAgICAgICAgICBUZW1wb3JhcnlQYXNzd29yZDogdGVtcG9yYXJ5UGFzc3dvcmQsXG4gICAgICAgICAgICBNZXNzYWdlQWN0aW9uOiAnU1VQUFJFU1MnIGFzIGNvbnN0LFxuICAgICAgICAgIH1cbiAgICAgICAgOiB7XG4gICAgICAgICAgICBEZXNpcmVkRGVsaXZlcnlNZWRpdW1zOiBbJ0VNQUlMJyBhcyBjb25zdF0sXG4gICAgICAgICAgfSksXG4gICAgICBGb3JjZUFsaWFzQ3JlYXRpb246IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2xpZW50LnNlbmQoY29tbWFuZCk7XG5cbiAgICBpZiAoIXJlc3VsdC5Vc2VyPy5Vc2VybmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gY3JlYXRlIENvZ25pdG8gdXNlciAtIG5vIHVzZXJuYW1lIHJldHVybmVkJyk7XG4gICAgfVxuXG4gICAgLy8gVGhlICdzdWInIGF0dHJpYnV0ZSBjb250YWlucyB0aGUgdW5pcXVlIENvZ25pdG8gdXNlciBJRFxuICAgIGNvbnN0IHN1YkF0dHJpYnV0ZSA9IHJlc3VsdC5Vc2VyLkF0dHJpYnV0ZXM/LmZpbmQoXG4gICAgICAoYXR0cikgPT4gYXR0ci5OYW1lID09PSAnc3ViJ1xuICAgICk7XG5cbiAgICBpZiAoIXN1YkF0dHJpYnV0ZT8uVmFsdWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGdldCBDb2duaXRvIHVzZXIgc3ViJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvZ25pdG9JZDogc3ViQXR0cmlidXRlLlZhbHVlLFxuICAgICAgdXNlcm5hbWU6IHJlc3VsdC5Vc2VyLlVzZXJuYW1lLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgVXNlcm5hbWVFeGlzdHNFeGNlcHRpb24pIHtcbiAgICAgIHRocm93IG5ldyBDb2duaXRvRXJyb3IoJ1VTRVJOQU1FX0VYSVNUUycsICdBIHVzZXIgd2l0aCB0aGlzIHVzZXJuYW1lIGFscmVhZHkgZXhpc3RzJyk7XG4gICAgfVxuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEludmFsaWRQYXJhbWV0ZXJFeGNlcHRpb24pIHtcbiAgICAgIHRocm93IG5ldyBDb2duaXRvRXJyb3IoJ0lOVkFMSURfUEFSQU1FVEVSJywgKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlKTtcbiAgICB9XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXQgYSBDb2duaXRvIHVzZXIgYnkgdXNlcm5hbWVcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldENvZ25pdG9Vc2VyKHVzZXJuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHsgY29nbml0b0lkOiBzdHJpbmc7IHN0YXR1czogc3RyaW5nIH0gfCBudWxsPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBBZG1pbkdldFVzZXJDb21tYW5kKHtcbiAgICAgIFVzZXJQb29sSWQ6IFVTRVJfUE9PTF9JRCxcbiAgICAgIFVzZXJuYW1lOiB1c2VybmFtZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNsaWVudC5zZW5kKGNvbW1hbmQpO1xuXG4gICAgY29uc3Qgc3ViQXR0cmlidXRlID0gcmVzdWx0LlVzZXJBdHRyaWJ1dGVzPy5maW5kKFxuICAgICAgKGF0dHIpID0+IGF0dHIuTmFtZSA9PT0gJ3N1YidcbiAgICApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvZ25pdG9JZDogc3ViQXR0cmlidXRlPy5WYWx1ZSB8fCAnJyxcbiAgICAgIHN0YXR1czogcmVzdWx0LlVzZXJTdGF0dXMgfHwgJ1VOS05PV04nLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKChlcnJvciBhcyB7IG5hbWU/OiBzdHJpbmcgfSkubmFtZSA9PT0gJ1VzZXJOb3RGb3VuZEV4Y2VwdGlvbicpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgYSBDb2duaXRvIHVzZXIgKHByZXZlbnRzIGxvZ2luIGJ1dCBkb2Vzbid0IGRlbGV0ZSlcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRpc2FibGVDb2duaXRvVXNlcih1c2VybmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGNvbW1hbmQgPSBuZXcgQWRtaW5EaXNhYmxlVXNlckNvbW1hbmQoe1xuICAgIFVzZXJQb29sSWQ6IFVTRVJfUE9PTF9JRCxcbiAgICBVc2VybmFtZTogdXNlcm5hbWUsXG4gIH0pO1xuXG4gIGF3YWl0IGNsaWVudC5zZW5kKGNvbW1hbmQpO1xufVxuXG4vKipcbiAqIEVuYWJsZSBhIHByZXZpb3VzbHkgZGlzYWJsZWQgQ29nbml0byB1c2VyXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmFibGVDb2duaXRvVXNlcih1c2VybmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGNvbW1hbmQgPSBuZXcgQWRtaW5FbmFibGVVc2VyQ29tbWFuZCh7XG4gICAgVXNlclBvb2xJZDogVVNFUl9QT09MX0lELFxuICAgIFVzZXJuYW1lOiB1c2VybmFtZSxcbiAgfSk7XG5cbiAgYXdhaXQgY2xpZW50LnNlbmQoY29tbWFuZCk7XG59XG5cbi8qKlxuICogRGVsZXRlIGEgQ29nbml0byB1c2VyIGNvbXBsZXRlbHlcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRlbGV0ZUNvZ25pdG9Vc2VyKHVzZXJuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgY29tbWFuZCA9IG5ldyBBZG1pbkRlbGV0ZVVzZXJDb21tYW5kKHtcbiAgICBVc2VyUG9vbElkOiBVU0VSX1BPT0xfSUQsXG4gICAgVXNlcm5hbWU6IHVzZXJuYW1lLFxuICB9KTtcblxuICBhd2FpdCBjbGllbnQuc2VuZChjb21tYW5kKTtcbn1cblxuLyoqXG4gKiBSZXNldCBhIHVzZXIncyBwYXNzd29yZC5cbiAqIC0gSWYgdGVtcG9yYXJ5UGFzc3dvcmQgaXMgcHJvdmlkZWQsIHNldCBpdCBhcyBhIHRlbXBvcmFyeSBwYXNzd29yZCAoZm9yY2VzIGNoYW5nZSBvbiBsb2dpbikuXG4gKiAtIE90aGVyd2lzZSwgQ29nbml0byBzZW5kcyB0aGUgc3RhbmRhcmQgcmVzZXQgZW1haWwuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXNldENvZ25pdG9Vc2VyUGFzc3dvcmQoXG4gIHVzZXJuYW1lOiBzdHJpbmcsXG4gIHRlbXBvcmFyeVBhc3N3b3JkPzogc3RyaW5nXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKHRlbXBvcmFyeVBhc3N3b3JkKSB7XG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBBZG1pblNldFVzZXJQYXNzd29yZENvbW1hbmQoe1xuICAgICAgVXNlclBvb2xJZDogVVNFUl9QT09MX0lELFxuICAgICAgVXNlcm5hbWU6IHVzZXJuYW1lLFxuICAgICAgUGFzc3dvcmQ6IHRlbXBvcmFyeVBhc3N3b3JkLFxuICAgICAgUGVybWFuZW50OiBmYWxzZSxcbiAgICB9KTtcbiAgICBhd2FpdCBjbGllbnQuc2VuZChjb21tYW5kKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBjb21tYW5kID0gbmV3IEFkbWluUmVzZXRVc2VyUGFzc3dvcmRDb21tYW5kKHtcbiAgICBVc2VyUG9vbElkOiBVU0VSX1BPT0xfSUQsXG4gICAgVXNlcm5hbWU6IHVzZXJuYW1lLFxuICB9KTtcbiAgYXdhaXQgY2xpZW50LnNlbmQoY29tbWFuZCk7XG59XG5cbi8qKlxuICogTGlzdCBhbGwgdXNlcnMgaW4gQ29nbml0byB1c2VyIHBvb2xcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb2duaXRvVXNlckluZm8ge1xuICBjb2duaXRvSWQ6IHN0cmluZztcbiAgdXNlcm5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgY3JlYXRlZEF0OiBEYXRlO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbGlzdENvZ25pdG9Vc2VycygpOiBQcm9taXNlPENvZ25pdG9Vc2VySW5mb1tdPiB7XG4gIGNvbnN0IHVzZXJzOiBDb2duaXRvVXNlckluZm9bXSA9IFtdO1xuICBsZXQgcGFnaW5hdGlvblRva2VuOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgZG8ge1xuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgTGlzdFVzZXJzQ29tbWFuZCh7XG4gICAgICBVc2VyUG9vbElkOiBVU0VSX1BPT0xfSUQsXG4gICAgICBQYWdpbmF0aW9uVG9rZW46IHBhZ2luYXRpb25Ub2tlbixcbiAgICAgIExpbWl0OiA2MCwgLy8gTWF4IGFsbG93ZWRcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNsaWVudC5zZW5kKGNvbW1hbmQpO1xuXG4gICAgZm9yIChjb25zdCB1c2VyIG9mIHJlc3VsdC5Vc2VycyB8fCBbXSkge1xuICAgICAgY29uc3QgZ2V0QXR0cmlidXRlID0gKG5hbWU6IHN0cmluZykgPT5cbiAgICAgICAgdXNlci5BdHRyaWJ1dGVzPy5maW5kKChhdHRyKSA9PiBhdHRyLk5hbWUgPT09IG5hbWUpPy5WYWx1ZSB8fCAnJztcblxuICAgICAgdXNlcnMucHVzaCh7XG4gICAgICAgIGNvZ25pdG9JZDogZ2V0QXR0cmlidXRlKCdzdWInKSxcbiAgICAgICAgdXNlcm5hbWU6IHVzZXIuVXNlcm5hbWUgfHwgJycsXG4gICAgICAgIGVtYWlsOiBnZXRBdHRyaWJ1dGUoJ2VtYWlsJyksXG4gICAgICAgIG5hbWU6IGdldEF0dHJpYnV0ZSgnbmFtZScpLFxuICAgICAgICBzdGF0dXM6IHVzZXIuVXNlclN0YXR1cyB8fCAnVU5LTk9XTicsXG4gICAgICAgIGNyZWF0ZWRBdDogdXNlci5Vc2VyQ3JlYXRlRGF0ZSB8fCBuZXcgRGF0ZSgpLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcGFnaW5hdGlvblRva2VuID0gcmVzdWx0LlBhZ2luYXRpb25Ub2tlbjtcbiAgfSB3aGlsZSAocGFnaW5hdGlvblRva2VuKTtcblxuICByZXR1cm4gdXNlcnM7XG59XG5cbi8qKlxuICogQ3VzdG9tIGVycm9yIGNsYXNzIGZvciBDb2duaXRvLXJlbGF0ZWQgZXJyb3JzXG4gKi9cbmV4cG9ydCBjbGFzcyBDb2duaXRvRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBjb2RlOiBzdHJpbmcsXG4gICAgbWVzc2FnZTogc3RyaW5nXG4gICkge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9ICdDb2duaXRvRXJyb3InO1xuICB9XG59XG4iXX0=