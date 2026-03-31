const winston = require('winston');
require('winston-daily-rotate-file');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `[${info.timestamp}] [${info.level.toUpperCase()}] ${info.message}`
  )
);

const transport = new winston.transports.DailyRotateFile({
  filename: 'logs/scraper-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d' // Keep logs for 14 days
});

const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    transport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

module.exports = logger;
