import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  UsernameExistsException,
  InvalidParameterException,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-2',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

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
export async function createCognitoUser(
  options: CreateCognitoUserOptions
): Promise<CognitoUserResult> {
  const { username, email, name, temporaryPassword, suppressEmail } = options;

  try {
    const command = new AdminCreateUserCommand({
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
            MessageAction: 'SUPPRESS' as const,
          }
        : {
            DesiredDeliveryMediums: ['EMAIL' as const],
          }),
      ForceAliasCreation: false,
    });

    const result = await client.send(command);

    if (!result.User?.Username) {
      throw new Error('Failed to create Cognito user - no username returned');
    }

    // The 'sub' attribute contains the unique Cognito user ID
    const subAttribute = result.User.Attributes?.find(
      (attr) => attr.Name === 'sub'
    );

    if (!subAttribute?.Value) {
      throw new Error('Failed to get Cognito user sub');
    }

    return {
      cognitoId: subAttribute.Value,
      username: result.User.Username,
    };
  } catch (error) {
    if (error instanceof UsernameExistsException) {
      throw new CognitoError('USERNAME_EXISTS', 'A user with this username already exists');
    }
    if (error instanceof InvalidParameterException) {
      throw new CognitoError('INVALID_PARAMETER', (error as Error).message);
    }
    throw error;
  }
}

/**
 * Get a Cognito user by username
 */
export async function getCognitoUser(username: string): Promise<{ cognitoId: string; status: string } | null> {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });

    const result = await client.send(command);

    const subAttribute = result.UserAttributes?.find(
      (attr) => attr.Name === 'sub'
    );

    return {
      cognitoId: subAttribute?.Value || '',
      status: result.UserStatus || 'UNKNOWN',
    };
  } catch (error) {
    if ((error as { name?: string }).name === 'UserNotFoundException') {
      return null;
    }
    throw error;
  }
}

/**
 * Disable a Cognito user (prevents login but doesn't delete)
 */
export async function disableCognitoUser(username: string): Promise<void> {
  const command = new AdminDisableUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
  });

  await client.send(command);
}

/**
 * Enable a previously disabled Cognito user
 */
export async function enableCognitoUser(username: string): Promise<void> {
  const command = new AdminEnableUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
  });

  await client.send(command);
}

/**
 * Delete a Cognito user completely
 */
export async function deleteCognitoUser(username: string): Promise<void> {
  const command = new AdminDeleteUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
  });

  await client.send(command);
}

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

export async function listCognitoUsers(): Promise<CognitoUserInfo[]> {
  const users: CognitoUserInfo[] = [];
  let paginationToken: string | undefined;

  do {
    const command = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      PaginationToken: paginationToken,
      Limit: 60, // Max allowed
    });

    const result = await client.send(command);

    for (const user of result.Users || []) {
      const getAttribute = (name: string) =>
        user.Attributes?.find((attr) => attr.Name === name)?.Value || '';

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
export class CognitoError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'CognitoError';
  }
}
