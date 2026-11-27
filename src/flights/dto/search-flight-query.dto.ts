import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.decorator';

const toUpperCase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

export class SearchFlightQuery {
  @Transform(toUpperCase)
  @Matches(/^[A-Z]{3}$/, { message: 'origin must be a 3-letter airport code' })
  origin: string;

  @Transform(toUpperCase)
  @Matches(/^[A-Z]{3}$/, {
    message: 'destination must be a 3-letter airport code',
  })
  destination: string;

  @IsDateOnly()
  date: string;
}
