import { Injectable } from '@nestjs/common';
import { SearchFlightQuery } from './dto/search-flight-query.dto';
import { ServiceValidationError } from '../common/errors/service-validation.error';

@Injectable()
export class FlightsService {
  public searchFlights(query: SearchFlightQuery) {
    if (query.destination === query.origin) {
      throw new ServiceValidationError(
        'origin and destination must be different',
      );
    }
    return query;
  }
}
