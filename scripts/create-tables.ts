import {
  CreateTableCommand,
  CreateTableCommandInput,
  DynamoDBClient,
  ListTablesCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
  region: process.env.AWS_REGION ?? 'ap-southeast-2',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

const tables: CreateTableCommandInput[] = [
  {
    TableName: 'flights',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'flightNumber', AttributeType: 'S' },
      { AttributeName: 'departureDate', AttributeType: 'S' },
      { AttributeName: 'route', AttributeType: 'S' },
      { AttributeName: 'departureAtUtc', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'flightNumber', KeyType: 'HASH' },
      { AttributeName: 'departureDate', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'route-index',
        KeySchema: [
          { AttributeName: 'route', KeyType: 'HASH' },
          { AttributeName: 'departureAtUtc', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: 'bookings',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [{ AttributeName: 'bookingRef', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'bookingRef', KeyType: 'HASH' }],
  },
];

async function main(): Promise<void> {
  const { TableNames: existing = [] } = await client.send(
    new ListTablesCommand({}),
  );

  for (const table of tables) {
    const name = table.TableName!;

    if (existing.includes(name)) {
      console.log(`Table "${name}" already exists, skipping`);
      continue;
    }

    await client.send(new CreateTableCommand(table));
    await waitUntilTableExists(
      { client, maxWaitTime: 30 },
      { TableName: name },
    );
    console.log(`Table "${name}" created`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
