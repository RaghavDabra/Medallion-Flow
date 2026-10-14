# MedallionFlow

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![React](https://img.shields.io/badge/React-JSX-61dafb.svg)
![Python](https://img.shields.io/badge/Python-Pandas%2FNumPy-3776ab.svg)

> A demonstrable web app that implements the **Medallion Architecture**
> (Bronze → Silver → Gold) end-to-end, with Claude AI analysing each layer.

## Why

Real-world data is messy. It arrives raw, full of nulls, duplicates and
inconsistent formats. Production data-engineering teams (at companies like BHP, NAB
and BofA) tame this with the **Medallion Architecture**, a three-layer pattern:

- **Bronze** → raw data lands exactly as ingested, nothing touched. The
  "source of truth" archive.
- **Silver** → data is cleaned: duplicates removed, nulls handled, values
  standardised. This is what analysts query day-to-day.
- **Gold** → data is aggregated into business-ready summaries — KPIs, groupings,
  dimensional tables. This feeds dashboards and reports.

MedallionFlow implements all three layers, with Python (Pandas/NumPy) doing the
transformations and Claude AI sitting on top to analyse each layer — flagging
quality issues, recommending next-step transformations, and suggesting schema
designs (Star/Snowflake). It's essentially what a Databricks notebook pipeline
does, built as an interactive web app.

## Features

- **End-to-end Bronze → Silver → Gold pipeline** over an uploaded dataset.
- **Deterministic transforms** in Python (Pandas/NumPy): de-duplication, null
  handling, standardisation, aggregation.
- **AI layer analysis** with Claude: data-quality flags, transformation
  recommendations, and Star/Snowflake schema suggestions.
- **Single-file React UI** (`MedallionFlow.jsx`) that walks through each layer.

## Getting started

`MedallionFlow.jsx` is a React component. Drop it into a React app (e.g. a Vite or
Create React App project) and render it:

```bash
# in a React project
npm install
npm run dev
```

```jsx
import MedallionFlow from "./MedallionFlow";

export default function App() {
  return <MedallionFlow />;
}
```

If you wire up the Claude-powered analysis, supply your Anthropic API key through
the app's configured environment variable (never commit the key).

## License

Released under the [MIT License](./LICENSE). © 2026 Raghav Dabra.

## Author

Built by [Raghav Dabra](https://github.com/RaghavDabra).
