# LabLink

LabLink is a responsive campus laboratory resource-sharing dashboard built with React and Vite. Students can discover shared equipment, request time slots, track project access, and plan around availability. Faculty can review booking and access requests.

## Workflows

- Dashboard overview with requests, campus inventory, and upcoming schedule
- Equipment directory with capability search, category and department filters, availability filters, and sorting
- Equipment details, specifications, location, training, inspection, and reservation form
- Booking validation for lab hours, past dates/times, duration, and overlapping reservations
- Student booking status, cancellation of pending requests, and review feedback
- Project access requests with faculty sponsorship and status tracking
- Monthly availability calendar with equipment filtering and day-level reservations
- Faculty approval queue with status filters, approval actions, and required reasons for declines
- Resource planner that matches project terms to catalog capabilities and finds open slots before a deadline

## Run locally

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

Run the quality checks before sharing changes:

```sh
npm run lint
npm run build
```

## Demo data and limitations

The app seeds realistic sample records and stores booking and project-request changes in this browser's local storage. Clearing this browser's site data resets the sample state. There is no connected campus identity provider, backend, database, or external AI service. The resource planner uses transparent local capability tags and reservation data; it is a planning prototype, not a generative AI model.

For production, move persistence and authorization to a campus service and enforce slot conflicts transactionally on the server. Browser-side checks improve usability but are not an authoritative security or availability boundary.
