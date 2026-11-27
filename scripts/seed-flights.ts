import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DateTime } from 'luxon';
import { Flight } from '../src/flights/flight.entity';
import { Schedule, generateFlights } from './generate-flights';
import * as schedules from './data/schedules.json';
import * as airports from '../src/airports/airports.json';

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
    region: process.env.AWS_REGION ?? 'ap-southeast-2',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  }),
);

export const seedFlights = async (flights: Flight[]) => {
  for (const flight of flights) {
    await client.send(new PutCommand({ TableName: 'flights', Item: flight }));
  }
};

const main = async () => {
  const flights = generateFlights(schedules as Schedule[], airports, {
    startDate: DateTime.now().toISODate(),
    numberOfDays: 90,
  });

  await seedFlights(flights);
  console.log(`Seeded ${flights.length} flights`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
