import { Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FlightsModule } from './flights/flights.module';
import { BookingsModule } from './bookings/bookings.module';
import { AirportsModule } from './airports/airports.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',

        // Readable, coloured logs locally. Plain JSON in production, so log tools can search the fields
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,

        // Runs once per request. The id is added to every log line written during that request
        genReqId: (req, res) => {
          // Reuse the caller's id if it sent one, so one request can be followed across services
          const header = req.headers['x-request-id'];
          const id = typeof header === 'string' ? header : randomUUID();

          // Return the id to the caller, so a problem they report can be found in the logs
          res.setHeader('X-Request-Id', id);
          return id;
        },

        // Level of the request log: error = our fault, warn = the caller's fault, info = success
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) {
            return 'error';
          }
          if (res.statusCode >= 400) {
            return 'warn';
          }
          return 'info';
        },

        // Only log the fields that are needed. Headers are left out, so tokens and cookies never reach the logs
        serializers: {
          req: (req) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    FlightsModule,
    BookingsModule,
    AirportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
