import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FlightsModule } from './flights/flights.module';
import { BookingsModule } from './bookings/bookings.module';
import { AirportsModule } from './airports/airports.module';

@Module({
  imports: [FlightsModule, BookingsModule, AirportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
