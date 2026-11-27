import { Flight } from '../src/flights/flight.entity';
import { DateTime } from 'luxon';
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
}

export interface Schedule {
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureTime: string;
  durationMinutes: number;
  days: Weekday[];
  totalSeats: number;
  basePriceCents: number;
}

export interface GenerateFlightsOptions {
  startDate: string;
  numberOfDays: number;
}

const airportLookup = (
  code: string,
  airports: Airport[],
): Airport | undefined => {
  return airports.find((air) => air.code === code);
};

export const generateFlights = (
  schedules: Schedule[],
  airports: Airport[],
  options: GenerateFlightsOptions,
): Flight[] => {
  const flights: Flight[] = [];

  for (let i = 0; i < options.numberOfDays; i++) {
    const date = DateTime.fromISO(options.startDate, { zone: 'utc' }).plus({
      days: i,
    });
    const dayOfWeek = date.weekday as Weekday;

    for (const schedule of schedules) {
      if (!schedule.days.includes(dayOfWeek)) {
        continue;
      }

      const { days, departureTime, durationMinutes, basePriceCents, ...rest } =
        schedule;

      const origin = airportLookup(rest.origin, airports);
      const destination = airportLookup(rest.destination, airports);

      if (!origin || !destination) {
        continue;
      }

      const departure = DateTime.fromISO(
        `${date.toISODate()}T${departureTime}`,
        { zone: origin.timezone },
      );
      const arrival = departure
        .plus({ minutes: durationMinutes })
        .setZone(destination.timezone);

      const flight: Flight = {
        ...rest,
        departureDate: departure.toISODate(),
        departureAt: departure.toISO({ suppressMilliseconds: true }),
        departureAtUtc: departure.toUTC().toISO({ suppressMilliseconds: true }),
        arrivalAt: arrival.toISO({ suppressMilliseconds: true }),
        priceCents: basePriceCents,
        currency: 'USD',
        seatsAvailable: rest.totalSeats,
      };

      flights.push(flight);
    }
  }
  return flights;
};
