import { WinstonModule } from 'nest-winston';
import { transports, format } from 'winston';
import 'winston-daily-rotate-file';

export const logger = WinstonModule.createLogger({
    transports: [
        // file on daily rotation (error only)
        new transports.DailyRotateFile({
            // %DATE will be replaced by the current date
            filename: `logs/%DATE%-error.log`,
            level: 'error',
            format: format.combine(
                format.timestamp(),
                format.errors({ stack: true }),
                format.json(),
            ),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true, // zip old log files
            maxFiles: '7d', // will keep log until they are older than 7 days
        }),
        // same for all levels
        new transports.DailyRotateFile({
            filename: `logs/%DATE%-combined.log`,
            format: format.combine(
                format.timestamp(),
                format.json(),
                // format.prettyPrint(),
            ),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true, // zip old log files
            maxFiles: '7d',
        }),
        // console
        new transports.Console({
            format: format.combine(
                format.cli(),
                format.splat(),
                format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss',
                }),
                format.colorize({ all: true }),
                format.simple(),
                format.printf(({ context, level, message, timestamp }) => {
                    return `${timestamp}\t${level} [${context}] ${message}`;
                }),
            ),
        }),

    ],
});
