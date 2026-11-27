import { estypes } from '@elastic/elasticsearch';

export const FLIGHTS_INDEX = 'flights';

export const flightsIndexMapping: estypes.MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    flightNumber: { type: 'keyword' },
    departureDate: { type: 'keyword' },
    airline: { type: 'keyword' },
    origin: { type: 'keyword' },
    destination: { type: 'keyword' },
    departureAt: { type: 'date' },
    departureAtUtc: { type: 'date' },
    arrivalAt: { type: 'date' },
    priceCents: { type: 'integer' },
    currency: { type: 'keyword' },
    totalSeats: { type: 'integer' },
    seatsAvailable: { type: 'integer' },
  },
};
