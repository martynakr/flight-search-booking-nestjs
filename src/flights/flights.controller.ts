import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
} from '@nestjs/common';
import { SearchFlightQuery } from './dto/search-flight-query.dto';
import { FlightsService } from './flights.service';
import { ServiceValidationError } from '../common/errors/service-validation.error';

@Controller('flights')
export class FlightsController {
  private readonly logger = new Logger(FlightsController.name);

  constructor(private readonly flightsService: FlightsService) {}

  @Get('search')
  async searchFlights(@Query() query: SearchFlightQuery) {
    try {
      return await this.flightsService.searchFlights(query);
    } catch (error) {
      if (error instanceof ServiceValidationError) {
        this.logger.warn(error.message);
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
