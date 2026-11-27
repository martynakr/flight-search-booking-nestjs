import { Injectable } from '@nestjs/common';
import { Airport } from './airport.entity';
import * as airports from './airports.json';

@Injectable()
export class AirportsService {
  findByCode(code: string): Airport | undefined {
    return (airports as Airport[]).find((airport) => airport.code === code);
  }
}
