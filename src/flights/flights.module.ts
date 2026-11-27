import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { FlightsRepository } from './flights.repository';
import { AirportsModule } from '../airports/airports.module';

@Module({
  imports: [
    ElasticsearchModule.register({
      node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200',
    }),
    AirportsModule,
  ],
  controllers: [FlightsController],
  providers: [FlightsService, FlightsRepository],
})
export class FlightsModule {}
