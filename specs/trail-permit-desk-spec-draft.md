> First rough draft, written quickly before refining the plan. Several details (queries,
> indexes, the schema) were corrected in [v1](trail-permit-desk-spec.v1.md). The final
> design is in v1 and v2.

objective: create a full-stack app for a trail permit desk
stack/technologies:
- frontend: vue, typescript, bootstrap, jest, cypress
- backend: node.js, typescript, REST API, node-postgres, jest
- database: postgresql

general rules:
- ask the user to review before committing
- commit per task
- prioritize readability and simplicity
- stick to the scope of each task
- NEVER assume. ask the user for clarification.
- the backend only sends a code. the frontend centralizes the content/text for those codes
- for the frontend: create service functions for calling API endpoints, then create a composable that calls these services
- API endpoints should always have a logger:
  - log when it's called
  - log when the operation is successful
  - log on errors
- the backend should maintain a mapping of errors: the error number and code
- for each view in the frontend that calls/depends on an endpoint:
  - render a loading state (just a simple loader)
  - render a toast for errors (a message for the specific code if there is one, otherwise a generic "Something went wrong. Please try again later")
  - render a generic empty state for lists
  - always add CCT tests for the loading, error, and empty states
- for every API endpoint, the unit tests by default:
  - add a test for the success path
  - add a test for the empty state if applicable
  - add a test for 500 errors

tasks:
[setup] create a personal repo "trail-permit-desk"

[setup] set up the app
- keep the folder structure simple: one folder for the backend, one for the frontend
- a folder for the database, if needed
- remove unnecessary boilerplate

[setup] verify the app
- create npm scripts:
  - in the backend folder:
    - start: starts the backend server
    - seed: seeds the database
    - test: runs all jest tests
  - in the frontend folder:
    - start: starts the frontend server
    - unit-test: runs all jest tests
    - component-test: runs all CCT tests
- verification (insert ".tmp" in the filenames):
  - create a throwaway database table
  - create a throwaway API endpoint
  - create a throwaway button (using bootstrap) that calls the endpoint
  - the frontend should receive the data from the database
  - create a throwaway unit test for the API endpoint using jest and run it
  - create a throwaway CCT test for the button and run it

[setup] clean up all throwaway files from the verification process
- verification: no more .tmp files

[setup] add the given data (trails.json, channels.json)
- verification: a folder called /data exists with the two json files

[be] create a function for cleaning the data
- accepts 2 args (schemaTransformer: Record<string, function>, messyData: Record<string, unknown>)
- iterates over the values of messyData and runs the matching function from schemaTransformer
- returns a new object that has gone through the schemaTransformer
- verification (unit tests):
  - should transform messy data to its desired schema
  - should retain the original value when a value has no transformer
  - should return an empty object when an error is encountered

[be] create tables
CHANNELS {
  id: unique
  label: string
  max_party: number
  fields: [
    key: string, unique, required
    label: string, required
    type: text|email|number|tel|textarea|...
    required: boolean, required
    min: number
    pattern: string
    options: [value: string, required; label: string, required]
    max_length: number
  ]
}

TRAILS {
  code: string, unique
  name: string
  daily_quota: number
  status: string
  updated_at: Date
}

all fields above are required

PERMITS {
  trail: references trails.code, required
  date: Date, required
  party_size: number, required
  status: active|cancelled, required
  channel: references channels.id, required
  ...other keys required by the channel
}

verification: when querying the database, it should return these 3 tables as empty

[be] seed the database
- import the json files
- run the trails through the cleaning function
- deduplicate trails. the latest updated_at wins
- seed the trails data
- seed the channels data
- seed 50,000 randomized permits
- verification:
  - query the trails table. it should return all trails
  - query the channels table. it should return all channels
  - query the permits table count. it should return 50,000

[fe] create a landing page
- a large "Trail Permit Desk" title with two buttons below:
  - Request a permit (CTA, primary color)
  - Find a permit (secondary color)
- add a simple description below the title
- verification (cct):
  - the "Trail Permit Desk" text is rendered
  - the two buttons are rendered
  - clicking the Request a permit button redirects to the /request-permit page
  - clicking the Find a permit button redirects to the /find-permit page

[fe] create a 4-page form skeleton
- render previous and next buttons at the top
- between these 2 buttons is a step counter (the step counter should be flexible: new steps can be added by configuring a single variable)
- maintain an object for the form schema/mapping: {
  "Title": FormComponent to render,
}
- render an empty card container in the middle (this is where the form will be rendered)
- verification (cct):
  - the two buttons are rendered (and accessible)
  - the step counter is rendered

[fe] page 1: calendar view
- register a new route
- create a utility function, computeDateRange, that returns the list of dates to show:
  - accepts 1 arg: the number of days to cover
  - gets the current date
  - gets all dates up to 30 days ahead
  - returns an object: {
    Nov: [28, 29, 30],
    Dec: [1, 2, 3, 4, 5, ...],
    ...
  }
- render these dates 7 days per row (start the calendar view from the current day)
- these dates should be selectable, and only one date can be selected at once
- verification (jest for the utility function):
  - should return the correct number of days (use it.each covering various scenarios)
  - should correctly wrap around the months of the year
- verification (cct for the calendar view):
  - should render all 31 days
  - should render the correct month(s)
  - a month should not be visible more than once

[be] create an endpoint for the list of trails + availability for a given date
- select all active permits for the given date
- group by trail
- get the sum of all the party_size values
- join with the TRAILS table by code
- the result is the list of trails with the trail code, trail name, trail daily_quota, trail status, and total current number of hikers
- verification (unit test):
  - should count active permits only
  - should also include closed trails
  - should also include full trails
  - should return an empty array if no data is found
  - should handle errors gracefully (500, SERVER_ERROR)

[fe] page 2: trail selection
- a list of trail cards
- each card shows:
  - the trail name (if none, default to the trail code)
  - a counter (current hikers / daily_quota)
  - the trail status: add a status pill for FULL and CLOSED, and disable the card
- add an error state for server errors
- add an empty state
- these cards should be selectable. one card can be selected at a time
- verification (cct):
  - should render the correct number of cards for the trails
  - should render the trail code if there is no trail name
  - should render the counter correctly
  - should render a status pill if FULL and disable the card
  - should render a status pill if CLOSED and disable the card

[fe] create a reusable component called dynamic-input that can handle different types of inputs
- renders all the types used in channels.json
- uses bootstrap components
- shows the appropriate validation messages
- verification (cct):
  - should be able to render an input dynamically (it.each on the types)
  - should not render anything if the input type is not covered

[fe] page 3: channel selection
- render a list of cards of all available channels
- for each card, show the label and the maximum party size. do not simply show max_party: take the number of available slots into account and show min(max_party, available_slots)
- verification (cct):
  - should render the correct number of available slots for each card
  - should render all available channels

[be] create an endpoint for the list of channels (with their metadata)
- select from the channels table and return the result
- handle errors gracefully
- return an empty array for the empty state
- verification (unit test):
  - should return the channels data correctly
  - should throw a server error (500, SERVER_ERROR)

[fe] page 4: build the config-driven form using dynamic-input
- integrate dynamic-input and render the form from the metadata returned by the endpoint, iterating over the fields and passing the props to dynamic-input
- this page has a save button
- verification (cct):
  - should be able to render a form with various fields (it.each)
  - should render a toast with a success message (Permit requested successfully) and redirect to the landing page

[be] create a save endpoint for saving the permit (IMPORTANT: data integrity)
- main problem: concurrency
- main goal: data integrity
- use database locks with transactions, and unique constraints for invariants
- behavior/verification (unit test):
  - users can book if there's an available slot for the trail
  - concurrent requests are handled properly, with NO OVERBOOKING (repeat this test 50 times, using Promise.all to simulate concurrent requests)
  - users cannot book the same trail on the same date
  - users cannot book when there are no available slots
  - users cannot book when the trail is closed
  - users cannot book if the trail has met its daily_quota with active permits
  - saving should be idempotent
  - should be able to retry 3 times with exponential backoff when it fails on the first try
  - should be able to identify an idempotent success (the first attempt failed for some reason, but the transaction still went through)
  - should throw a distinct error code when the user already booked the same date
  - should throw a distinct error code when the trail is full
  - should throw a distinct error code when the trail is closed

[fe] handle the error codes from the save endpoint on page 4 of the form
- render the message in the toast accordingly
- there should only be one toast
- verification (cct):
  - assert each error code

[be] create an index for the bookings
- index on (trail, date, party size, status, email)

[be] create a search endpoint
- create an endpoint for finding a booking by email
- verification (unit test):
  - query a booking and run EXPLAIN ANALYZE

[fe] create a search view (initial state, table state, empty state, error state)
- implement a search field at the top middle of the page. the placeholder is "Find a permit by email"
- in the initial state, render a short text explaining what to do
- in the loading state, render a loader
- with data, render a table with the columns trail, date, party size, status. dates are in ascending order, so the top of the list shows the trail that is coming up soonest
- in the empty state, render a generic empty state
