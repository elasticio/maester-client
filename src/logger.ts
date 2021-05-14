import { createLogger, LogLevel } from '@elastic.io/bunyan-logger';

/** @internal */
export default createLogger({
    name: 'object-storage-client',
    level: (process.env.NODE_ENV === 'test' ? process.env.LOG_LEVEL || Number.MAX_VALUE : process.env.LOG_LEVEL) as LogLevel
});
