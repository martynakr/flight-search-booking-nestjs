# Flight Search & Booking

A flight search and booking API built with NestJS and TypeScript, using DynamoDB to store flights and bookings and Elasticsearch to search them.

## DynamoDB and Elasticsearch

**DynamoDB is the source of truth. Elasticsearch is a read model.**

|          | DynamoDB                               | Elasticsearch                        |
| -------- | -------------------------------------- | ------------------------------------ |
| Job      | Stores flights and bookings            | Searches flights                     |
| Holds    | The real data                          | A copy of flights, shaped for search |
| Good at  | Safe writes, like taking the last seat | Filters, sorting and pages           |
| Bookings | Yes                                    | No, bookings are never searched      |

### How Elasticsearch stays up to date

All writes go to DynamoDB only. Nothing writes to Elasticsearch directly.

```
DynamoDB  -> DynamoDB Streams  -> indexer  ->  Elasticsearch
```

1. A flight changes in DynamoDB, for example a seat is booked.
2. DynamoDB Streams records the change.
3. The indexer reads the change and updates Elasticsearch.

If Elasticsearch is down, the changes wait in the stream and are applied later.

### Why not write to both

If the app wrote to DynamoDB and then to Elasticsearch, the second write could fail.
The two would then show different data, and nothing would fix it.

## Data model and design decisions

The project uses two DynamoDB tables: `flights` and `bookings`.

Every table has a partition key and can have a sort key.

- The **partition key** decides where an item is stored. It is always needed to find an item.
- The **sort key** keeps items in order inside the same partition key. This allows range queries, like "all of December".
- The partition key and sort key **together** must be unique.

### `flights` table

#### Access patterns

| #   | What is needed                      | Example                     |
| --- | ----------------------------------- | --------------------------- |
| 1   | Get one flight                      | QF1 on 1 Dec 2026           |
| 2   | Get all dates for one flight number | QF1 in December             |
| 3   | Take a seat when someone books      | QF1 on 1 Dec, one seat less |

Searching, like all flights from Melbourne to Sydney on 1 Dec, is done by Elasticsearch, not DynamoDB.

#### Keys

|               | Attribute       | Example                                            |
| ------------- | --------------- | -------------------------------------------------- |
| Partition key | `flightNumber`  | `QF1`                                              |
| Sort key      | `departureDate` | `2026-12-01` (local date at the departure airport) |

- **Get one flight (1):** `flightNumber = QF1` and `departureDate = 2026-12-01`
- **All dates for a flight (2):** `flightNumber = QF1` and `departureDate` between `2026-12-01` and `2026-12-31`
- **Take a seat (3):** update the flight by its key, only if `seatsAvailable > 0`

#### Why the flight number is the partition key, not the route

A booking says "book QF1 on 1 December". That is exactly the key, so the seat update is one direct call.

With the route as the main key:

- The key would be the route plus the exact UTC time. That is harder to pass around than "QF1 on 1 Dec"
- If the departure time changes, the key changes. A key cannot be changed, so the item would have to be deleted and created again.
- Busy routes like Melbourne to Sydney would put all their bookings on one partition.

So: the pattern that **changes** data decides the key. Search is done by Elasticsearch.

#### No secondary index

A GSI (global secondary index) would let DynamoDB search flights by route too.
The table does not have one, because Elasticsearch does the searching.

- Every write to a table is also written to each GSI, so it costs more.
- Two ways to search means twice the code and tests.
- If Elasticsearch is down, search shows an error. Booking still works, because it only uses DynamoDB.

### `bookings` table

#### Access patterns

| #   | What is needed                               | Example            |
| --- | -------------------------------------------- | ------------------ |
| 1   | Get a booking by its reference and last name | `ABC123` + `Smith` |

#### Keys

|               | Attribute    | Example  |
| ------------- | ------------ | -------- |
| Partition key | `bookingRef` | `ABC123` |

The booking reference is unique, so no sort key is needed.

#### Guest bookings

No account is needed to book. Like airlines, a booking is found with the **booking reference + passenger last name**.
The reference alone is not enough, because it is short and could be guessed.

- `GET /bookings/:ref?lastName=Smith` returns the booking only if the last name matches.
- A wrong reference and a wrong last name return the same "not found" error, so nobody can tell which part was right.
- The confirmation is sent to `contactEmail`.

### Booking a seat safely

A booking changes both tables at once, in one DynamoDB transaction (`TransactWriteItems`):

1. `flights`: take one seat, only if `seatsAvailable > 0`
2. `bookings`: create the booking, only if `bookingRef` does not exist yet

Either both happen or neither does. Two people cannot get the last seat.

### Times: local and UTC

Each flight stores its departure time twice:

| Field            | Example                     | Used for          |
| ---------------- | --------------------------- | ----------------- |
| `departureAt`    | `2026-12-01T06:00:00+11:00` | Showing to users  |
| `departureAtUtc` | `2026-11-30T19:00:00Z`      | Searching by time |

Times in different time zones are hard to compare.
So searches always use UTC (ends with `Z`).

#### "A day" means a day at the departure airport

A search for 1 December from Melbourne means 1 December in Melbourne, not in UTC.
So the start and end of that local day are converted to UTC before searching.

Example (Melbourne is UTC+11 in December):

|              | Melbourne time | UTC (used in the search) |
| ------------ | -------------- | ------------------------ |
| Start of day | 1 Dec 00:00    | 30 Nov 13:00             |
| End of day   | 1 Dec 23:59    | 1 Dec 12:59              |

This requires knowing each airport's time zone (for example `MEL` is `Australia/Melbourne`).

## Seeding flights

The app needs flights in the database.
Flights are not written by hand. They are made from a schedule, like airlines do.

### How flights are made

The input is two files:

| File                          | What it holds                 | Example                               |
| ----------------------------- | ----------------------------- | ------------------------------------- |
| `scripts/data/airports.json`  | Airports and their time zones | `MEL` is in `Australia/Melbourne`     |
| `scripts/data/schedules.json` | Flights that repeat           | QF401, MEL to SYD, every day at 06:00 |

`generateFlights` (in `scripts/generate-flights.ts`) turns schedules into flights:

1. Go through each day.
2. Go through each schedule. Skip it if it does not fly on that day.
3. Find the departure and arrival airports in `airports.json`. Skip the schedule if one is missing.
4. Work out the departure and arrival times, in each airport's local time.
5. Build the flight.

Flights are made for the next 90 days. That is about 7,000 flights.

For now, every flight has its base price and all seats free.

### How flights are seeded

```
docker compose up -d
npm run db:create-tables
npm run db:seed
```

- `db:create-tables` creates the tables. Tables that already exist are skipped.
- `db:seed` writes the flights to the `flights` table.
- Both are safe to run again. A flight with the same key is replaced, not added twice.

To empty the database:

```
docker compose down -v
```

## Known issues

### Seeding is slow

`db:seed` writes one flight at a time. That is about 7,000 requests, and takes around 30 seconds.

This is fine for now. Seeding only runs when the local database is set up or reset.

**Future fix:** use `BatchWriteCommand`. It writes 25 flights in one request.

### One cabin per flight

Each flight has one price and one seat count. There is no economy, business or first class.

This keeps booking simple for now. A booking takes one seat from one counter.

**Future fix:** give each flight a seat count and price per cabin, for example:

```ts
cabins: {
  ECONOMY:  { totalSeats: 150, seatsAvailable: 12, priceCents: 19900 },
  BUSINESS: { totalSeats: 30,  seatsAvailable: 4,  priceCents: 89900 },
}
```

A booking would then choose a cabin, and take a seat from that cabin only.
