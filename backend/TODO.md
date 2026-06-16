# TODO - Backend ATP TennisAbstract scraper fix

- [ ] Update backend/scraper/searchScraper.js ATP scraping to improve odds against 403 (realistic browser headers, cookie/session handling if supported, rotating UAs, retry with random delay)
- [ ] Preserve stale cache if refresh fails (keep old playerCache when ATP+WTA scrapes are blocked)
- [ ] Log response body (truncated) on 403 / non-200 for debugging
- [ ] Add cache status endpoint logging enough diagnostics (no API changes required)
- [ ] Run backend unit test: /api/search?name=jannik
- [ ] Commit and push backend-only changes

