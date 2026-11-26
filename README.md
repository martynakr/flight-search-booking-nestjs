# Flight Search & Booking

A flight search and booking API built with NestJS and TypeScript, using DynamoDB to store flights and bookings and Elasticsearch to search them.

## Data model and design decisions

The project uses two DynamoDB tables: `flights` and `bookings`.

Every table has a partition key and can have a sort key.

- The **partition key** decides where an item is stored. It is always needed to find an item.
- The **sort key** keeps items in order inside the same partition key. This allows range queries, like "all of December".
- The partition key and sort key **together** must be unique.
- A **GSI** (global secondary index) is a second copy of the data with different keys, so the data can be searched a different way. A GSI is read-only.

### `flights` table

#### Access patterns

| #   | What is needed                        | Example                      |
| --- | ------------------------------------- | ---------------------------- |
| 1   | Get one flight                        | QF1 on 1 Dec 2026            |
| 2   | Get all dates for one flight number   | QF1 in December              |
| 3   | Get all flights on a route on one day | Melbourne to Sydney on 1 Dec |
| 4   | Take a seat when someone books        | QF1 on 1 Dec, one seat less  |

#### Keys

|               | Attribute       | Example                                            |
| ------------- | --------------- | -------------------------------------------------- |
| Partition key | `flightNumber`  | `QF1`                                              |
| Sort key      | `departureDate` | `2026-12-01` (local date at the departure airport) |

- **Get one flight (1):** `flightNumber = QF1` and `departureDate = 2026-12-01`
- **All dates for a flight (2):** `flightNumber = QF1` and `departureDate` between `2026-12-01` and `2026-12-31`
- **Take a seat (4):** update the flight by its key, only if `seatsAvailable > 0`

#### GSI `route-index` (search by route)

|               | Attribute        | Example                |
| ------------- | ---------------- | ---------------------- |
| Partition key | `route`          | `MEL#SYD`              |
| Sort key      | `departureAtUtc` | `2026-11-30T23:00:00Z` |

- **Flights on a route on one day (3):** `route = MEL#SYD` and `departureAtUtc` between the start and end of that day.
- Results come back sorted by departure time.

#### Why the flight number is the partition key, not the route

DynamoDB can only change an item through the main table key. A GSI can only be read.

A booking says "book QF1 on 1 December". That is exactly the main key, so the seat update is one direct call.

With the route as the main key:

- The key would be the route plus the exact UTC time. That is harder to pass around than "QF1 on 1 Dec"
- If the departure time changes, the key changes. A key cannot be changed, so the item would have to be deleted and created again.
- Busy routes like Melbourne to Sydney would put all their bookings on one partition.

So: the pattern that **changes** data uses the main key. Patterns that only **search** use a GSI.

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

### Times: always UTC in keys

Sort keys are compared like text, letter by letter.
Times with different time zones do not sort correctly as text.
So every time inside a key is in UTC (ends with `Z`).

Each flight still stores its local time (`departureAt`) to show to users.

#### "A day" means a day at the departure airport

A search for 1 December from Melbourne means 1 December in Melbourne, not in UTC.
So the start and end of that local day are converted to UTC before searching.

Example (Melbourne is UTC+11 in December):

|              | Melbourne time | UTC (used in the search) |
| ------------ | -------------- | ------------------------ |
| Start of day | 1 Dec 00:00    | 30 Nov 13:00             |
| End of day   | 1 Dec 23:59    | 1 Dec 12:59              |

This requires knowing each airport's time zone (for example `MEL` is `Australia/Melbourne`).
