export const tokenConfig = {
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  accessTokenKey:
    process.env.ACCESS_TOKEN_KEY || 'default_access_key_change_me',
  refreshTokenKey:
    process.env.REFRESH_TOKEN_KEY || 'default_refresh_key_change_me',
};
