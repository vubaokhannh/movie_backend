export const REDIS_KEYS = {
  refreshToken: (userId: string | number, jti: string) =>
    `refresh:${jti}:${userId}`,
  accessBlacklist: (userId: string | number, jti: string) =>
    `blacklist:access:${jti}:${userId}`,
};
