import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { SearchFlightQuery } from './dto/search-flight-query.dto';
import { FlightsService } from './flights.service';
import { ServiceValidationError } from '../common/errors/service-validation.error';

@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get('search')
  async searchFlights(@Query() query: SearchFlightQuery) {
    try {
      return await this.flightsService.searchFlights(query);
    } catch (error) {
      if (error instanceof ServiceValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
