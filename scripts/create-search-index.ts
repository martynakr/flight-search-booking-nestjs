import { Client } from '@elastic/elasticsearch';
import {
  FLIGHTS_INDEX,
  flightsIndexMapping,
} from '../src/flights/search/flights-index';

const client = new Client({
  node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200',
});

const main = async () => {
  const exists = await client.indices.exists({ index: FLIGHTS_INDEX });

  if (exists) {
    console.log(`Index "${FLIGHTS_INDEX}" already exists, skipping`);
    return;
  }

  await client.indices.create({
    index: FLIGHTS_INDEX,
    mappings: flightsIndexMapping,
  });
  console.log(`Index "${FLIGHTS_INDEX}" created`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
