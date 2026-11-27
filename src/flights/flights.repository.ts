import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Flight } from './flight.entity';
import { FLIGHTS_INDEX } from './search/flights-index';

export interface FlightSearchCriteria {
  origin: string;
  destination: string;
  departureFromUtc: string;
  departureToUtc: string;
}

@Injectable()
export class FlightsRepository {
  constructor(private readonly elasticsearch: ElasticsearchService) {}

  async search(criteria: FlightSearchCriteria): Promise<Flight[]> {
    const response = await this.elasticsearch.search<Flight>({
      index: FLIGHTS_INDEX,
      size: 100,
      sort: [{ departureAtUtc: 'asc' }],
      query: {
        bool: {
          filter: [
            { term: { origin: criteria.origin } },
            { term: { destination: criteria.destination } },
            {
              range: {
                departureAtUtc: {
                  gte: criteria.departureFromUtc,
                  lt: criteria.departureToUtc,
                },
              },
            },
          ],
        },
      },
    });

    return response.hits.hits.map((hit) => hit._source);
  }
}
