import { Test } from '@nestjs/testing';
import { FlightsService } from './flights.service';
import { FlightsRepository } from './flights.repository';
import { AirportsService } from '../airports/airports.service';
import { Airport } from '../airports/airport.entity';
import { Flight } from './flight.entity';
import { ServiceValidationError } from '../common/errors/service-validation.error';
import * as fixtureFlights from '../../test/fixtures/flights.json';

const melbourne: Airport = {
  code: 'MEL',
  name: 'Melbourne Tullamarine',
  city: 'Melbourne',
  country: 'AU',
  timezone: 'Australia/Melbourne',
};

const sydney: Airport = {
  code: 'SYD',
  name: 'Sydney Kingsford Smith',
  city: 'Sydney',
  country: 'AU',
  timezone: 'Australia/Sydney',
};

const melbourneToSydneyFlights = (fixtureFlights as Flight[]).filter(
  (flight) =>
    flight.origin === 'MEL' &&
    flight.destination === 'SYD' &&
    flight.departureDate === '2026-12-01',
);

describe('FlightsService', () => {
  let service: FlightsService;
  let flightsRepository: { search: jest.Mock };
  let airportsService: { findByCode: jest.Mock };

  beforeEach(async () => {
    flightsRepository = { search: jest.fn().mockResolvedValue([]) };
    airportsService = {
      findByCode: jest.fn((code: string) =>
        [melbourne, sydney].find((airport) => airport.code === code),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: FlightsRepository, useValue: flightsRepository },
        { provide: AirportsService, useValue: airportsService },
      ],
    }).compile();

    service = module.get(FlightsService);

    // 28 Nov 2026, 11:00 in Melbourne
    jest.useFakeTimers({ now: new Date('2026-11-28T00:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects the same origin and destination', async () => {
    const result = service.searchFlights({
      origin: 'MEL',
      destination: 'MEL',
      date: '2026-12-01',
    });

    await expect(result).rejects.toThrow(ServiceValidationError);
    await expect(result).rejects.toThrow(
      'origin and destination must be different',
    );
    expect(flightsRepository.search).not.toHaveBeenCalled();
  });

  it('rejects an unknown origin', async () => {
    const result = service.searchFlights({
      origin: 'XYZ',
      destination: 'SYD',
      date: '2026-12-01',
    });

    await expect(result).rejects.toThrow(ServiceValidationError);
    await expect(result).rejects.toThrow('Unknown airport: XYZ');
    expect(flightsRepository.search).not.toHaveBeenCalled();
  });

  it('rejects an unknown destination', async () => {
    const result = service.searchFlights({
      origin: 'MEL',
      destination: 'XYZ',
      date: '2026-12-01',
    });

    await expect(result).rejects.toThrow(ServiceValidationError);
    await expect(result).rejects.toThrow('Unknown airport: XYZ');
    expect(flightsRepository.search).not.toHaveBeenCalled();
  });

  it('rejects a date in the past', async () => {
    const result = service.searchFlights({
      origin: 'MEL',
      destination: 'SYD',
      date: '2026-11-27',
    });

    await expect(result).rejects.toThrow(ServiceValidationError);
    await expect(result).rejects.toThrow('date must not be in the past');
    expect(flightsRepository.search).not.toHaveBeenCalled();
  });

  it('allows today at the origin', async () => {
    await service.searchFlights({
      origin: 'MEL',
      destination: 'SYD',
      date: '2026-11-28',
    });

    expect(flightsRepository.search).toHaveBeenCalled();
  });

  it('uses "today" at the origin, not in UTC', async () => {
    // 28 Nov in UTC, but already 29 Nov 01:00 in Melbourne
    jest.setSystemTime(new Date('2026-11-28T14:00:00Z'));

    const yesterdayInMelbourne = service.searchFlights({
      origin: 'MEL',
      destination: 'SYD',
      date: '2026-11-28',
    });
    await expect(yesterdayInMelbourne).rejects.toThrow(
      'date must not be in the past',
    );

    await service.searchFlights({
      origin: 'MEL',
      destination: 'SYD',
      date: '2026-11-29',
    });
    expect(flightsRepository.search).toHaveBeenCalled();
  });

  it('searches one local day at the origin, in UTC', async () => {
    await service.searchFlights({
      origin: 'MEL',
      destination: 'SYD',
      date: '2026-12-01',
    });

    expect(flightsRepository.search).toHaveBeenCalledWith({
      origin: 'MEL',
      destination: 'SYD',
      departureFromUtc: '2026-11-30T13:00:00.000Z',
      departureToUtc: '2026-12-01T13:00:00.000Z',
    });
  });

  it('searches a 25 hour day when daylight saving ends', async () => {
    // Melbourne moves from UTC+11 to UTC+10 on 4 Apr 2027
    await service.searchFlights({
      origin: 'MEL',
      destination: 'SYD',
      date: '2027-04-04',
    });

    expect(flightsRepository.search).toHaveBeenCalledWith({
      origin: 'MEL',
      destination: 'SYD',
      departureFromUtc: '2027-04-03T13:00:00.000Z',
      departureToUtc: '2027-04-04T14:00:00.000Z',
    });
  });

  it('returns the flights from the repository', async () => {
    flightsRepository.search.mockResolvedValue(melbourneToSydneyFlights);

    const flights = await service.searchFlights({
      origin: 'MEL',
      destination: 'SYD',
      date: '2026-12-01',
    });

    expect(flights).toEqual(melbourneToSydneyFlights);
  });
});
