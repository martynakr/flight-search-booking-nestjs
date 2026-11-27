import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Client } from '@elastic/elasticsearch';
import { Flight } from '../src/flights/flight.entity';
import { FLIGHTS_INDEX } from '../src/flights/search/flights-index';

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
    region: process.env.AWS_REGION ?? 'ap-southeast-2',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  }),
);

const elasticsearch = new Client({
  node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200',
});

const indexFlights = async (flights: Flight[]) => {
  const operations = flights.flatMap((flight) => [
    {
      index: {
        _index: FLIGHTS_INDEX,
        _id: `${flight.flightNumber}#${flight.departureDate}`,
      },
    },
    flight,
  ]);

  const response = await elasticsearch.bulk({ operations });

  if (response.errors) {
    const failed = response.items.filter((item) => item.index?.error);
    console.error(failed.slice(0, 5));
    throw new Error(`${failed.length} flights failed to index`);
  }
};

const main = async () => {
  let lastKey: Record<string, unknown> | undefined;
  let total = 0;

  do {
    const page = await dynamo.send(
      new ScanCommand({ TableName: 'flights', ExclusiveStartKey: lastKey }),
    );
    const flights = (page.Items ?? []) as Flight[];

    if (flights.length > 0) {
      await indexFlights(flights);
      total += flights.length;
      console.log(`Indexed ${total} flights`);
    }

    lastKey = page.LastEvaluatedKey;
  } while (lastKey);

  await elasticsearch.indices.refresh({ index: FLIGHTS_INDEX });
  console.log(`Done. ${total} flights in "${FLIGHTS_INDEX}"`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
