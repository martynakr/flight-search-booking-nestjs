import { Currency } from '../flights/flight.entity';

export type BookingStatus = 'CONFIRMED' | 'CANCELLED';

export interface Booking {
  bookingRef: string;
  flightNumber: string;
  departureDate: string;
  passengerFirstName: string;
  passengerLastName: string;
  contactEmail: string;
  status: BookingStatus;
  priceCents: number;
  currency: Currency;
  createdAt: string;
}
