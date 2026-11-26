export type Currency = 'USD';

export interface Flight {
  flightNumber: string;
  departureDate: string;
  airline: string;
  origin: string;
  destination: string;
  route: string;
  departureAt: string;
  departureAtUtc: string;
  arrivalAt: string;
  priceCents: number;
  currency: Currency;
  totalSeats: number;
  seatsAvailable: number;
}
