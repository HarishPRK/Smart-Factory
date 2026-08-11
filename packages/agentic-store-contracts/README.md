# Agentic Store contracts

Shared, vendor-neutral contracts for the local Agentic Store backend and its
future frontend. The backend simulator and a future PLC adapter both emit the
same `ObservationBatch` shape. UI consumers load `BootstrapResponse` once and
then apply ordered `StoreEventEnvelope` messages from the SSE stream.

These contracts deliberately expose concise agent activity and decision
receipts. They do not expose private chain-of-thought.
