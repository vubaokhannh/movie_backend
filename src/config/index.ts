import { tokenConfig } from './token.config';

export const appConfig = {
  port: Number(process.env.APP_PORT) || 3000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  token: tokenConfig,
};
