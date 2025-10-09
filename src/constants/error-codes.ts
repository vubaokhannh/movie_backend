export const ERROR_CODES = {
  USER_EXISTS: {
    code: 'AUTH_001',
    internalMessage: 'User with this email already exists',
    publicMessage: 'Registration failed',
  },
  ACCOUNT_NOT_FOUND: {
    code: 'AUTH_002',
    internalMessage: 'Account not found',
    publicMessage: 'Account not found',
  },
  INVALID_CREDENTIALS: {
    code: 'AUTH_003',
    internalMessage: 'Invalid credentials provided',
    publicMessage: 'Invalid email or password',
  },
  TOKEN_INVALID: {
    code: 'AUTH_004',
    internalMessage: 'Token invalid or expired',
    publicMessage: 'Session expired',
  },
};
