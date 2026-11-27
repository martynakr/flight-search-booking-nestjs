import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { SearchFlightQuery } from './dto/search-flight-query.dto';
import { ServiceValidationError } from '../common/errors/service-validation.error';
import { FlightsRepository } from './flights.repository';
import { AirportsService } from '../airports/airports.service';
import { Flight } from './flight.entity';

@Injectable()
export class FlightsService {
  constructor(
    private readonly flightsRepository: FlightsRepository,
    private readonly airportsService: AirportsService,
  ) {}
  public async searchFlights(query: SearchFlightQuery): Promise<Flight[]> {
    if (query.destination === query.origin) {
      throw new ServiceValidationError(
        'origin and destination must be different',
      );
    }

    const origin = this.airportsService.findByCode(query.origin);
    if (!origin) {
      throw new ServiceValidationError(`Unknown airport: ${query.origin}`);
    }

    const destination = this.airportsService.findByCode(query.destination);
    if (!destination) {
      throw new ServiceValidationError(`Unknown airport: ${query.destination}`);
    }

    const today = DateTime.now().setZone(origin.timezone).toISODate();
    if (query.date < today) {
      throw new ServiceValidationError('date must not be in the past');
    }

    const start = DateTime.fromISO(query.date, {
      zone: origin.timezone,
    }).startOf('day');
    const end = start.plus({ days: 1 });

    return this.flightsRepository.search({
      origin: origin.code,
      destination: destination.code,
      departureFromUtc: start.toUTC().toISO(),
      departureToUtc: end.toUTC().toISO(),
    });
  }
}
