#### Real-world data is messy
It arrives raw, full of nulls, duplicates, and inconsistent formats. Production data engineering teams (at companies like BHP, NAB, BofA) solve this using Medallion Architecture, a three-layer pattern:
 
##### Bronze → raw data lands exactly as ingested, nothing touched. Think of it as the "source of truth" archive.


##### Silver → data gets cleaned: duplicates removed, nulls handled, values standardised. This is what analysts query day-to-day.

##### Gold → data gets aggregated into business-ready summaries — KPIs, groupings, dimensional tables. This feeds dashboards and reports.

```
MedallionFlow implements all three layers end-to-end, with Python (Pandas/NumPy) 
doing the transformations, and Claude AI sitting on top to analyse each layer
``` 
 — flagging quality issues, recommending next-step transformations, and suggesting schema designs (Star/Snowflake). 

##### It's essentially what a Databricks notebook pipeline does, built as a demonstrable web app.
