/* eslint-disable import/first */
process.env.LOG_LEVEL = 'INFO';
process.env.LOG_OUTPUT_MODE = 'short';
process.env.NODE_ENV = 'test';
import getLogger from '@elastic.io/component-logger';
import sinon from 'sinon';
import { existsSync } from 'fs';
import { config } from 'dotenv';

if (existsSync('.env')) {
  config();
  const {
    ELASTICIO_OBJECT_STORAGE_TOKEN, ELASTICIO_OBJECT_STORAGE_URI,
  } = process.env;
  if (!ELASTICIO_OBJECT_STORAGE_TOKEN || !ELASTICIO_OBJECT_STORAGE_URI) {
    throw new Error('Please, provide all environment variables');
  }
} else {
  throw new Error('Please, provide environment variables to .env');
}
const { ELASTICIO_OBJECT_STORAGE_TOKEN, ELASTICIO_OBJECT_STORAGE_URI } = process.env;

export const creds = {
  jwtSecret: ELASTICIO_OBJECT_STORAGE_TOKEN,
  uri: ELASTICIO_OBJECT_STORAGE_URI,
  userAgent: 'userAgent'
};

export const getContext = () => ({
  logger: getLogger(),
  emit: sinon.spy(),
});
