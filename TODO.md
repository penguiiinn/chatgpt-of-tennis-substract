# TODO - Backend live tennis data layer (AceIntel)

- [ ] Create `backend/scraper/rankingsScraper.js` (ATP/WTA latest snapshot from Tennis Abstract)
- [ ] Create `backend/scraper/tournamentScraper.js` (current tournament feed from Tennis Abstract)
- [ ] Create `backend/scraper/historyScraper.js` (7-year player match history from Tennis Abstract)
- [ ] Create `backend/services/liveMatchService.js` (store latest matches + get last 10 from `liveDb`)
- [ ] Create `backend/services/rankingService.js` (fetch/store rankings snapshots + fast read)
- [ ] Create `backend/services/tournamentService.js` (fetch/store current tournament data + fast read)
- [ ] Create `backend/services/historyService.js` (backfill 7-year history into `liveDb`)
- [ ] Create `backend/routes/liveRoutes.js` (mount under `/api/live/*`)
- [ ] Create `backend/controllers/liveController.js` (thin controllers calling services)
- [ ] Update `backend/server.js` to mount `/api/live` routes
- [ ] Add basic warm-cache / job (optional): fetch rankings/tournaments on server start
- [ ] Smoke test: run `node backend/test-api.js` and verify new endpoints respond

## Non-goals / Must keep untouched
- [x] Keep existing H2H and player search untouched

