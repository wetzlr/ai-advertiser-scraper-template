import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { niche, city, max_results = 50 } = await req.json();
    if (!niche || !city) {
      return Response.json({ error: 'niche and city required' }, { status: 400 });
    }

    const token = Deno.env.get('APIFY_TOKEN');
    if (!token) {
      return Response.json({ error: 'Missing APIFY_TOKEN secret' }, { status: 500 });
    }

    const cap = Math.max(1, Math.min(Number(max_results) || 50, 500));

    const scrapeRun = await base44.entities.ScrapeRun.create({
      run_id: 'pending',
      niche,
      city,
      max_results: cap,
      status: 'running',
      inserted: 0,
      skipped: 0,
      error_message: '',
      started_at: new Date().toISOString(),
    });

    const runUrl = `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${token}`;

    const apifyBody = {
      searchStringsArray: [niche],
      locationQuery: city,
      maxCrawledPlaces: cap,
      maxCrawledPlacesPerSearch: cap,
      language: 'en',
      includeHistogram: false,
      includeOpeningHours: false,
      includePeopleAlsoSearch: false,
      maxReviews: 0,
      maxImages: 0,
      maxQuestions: 0,
    };

    const apifyRes = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyBody),
    });

    if (!apifyRes.ok) {
      const errBody = await apifyRes.text();
      await base44.entities.ScrapeRun.update(scrapeRun.id, {
        status: 'failed',
        error_message: `Apify start failed: ${apifyRes.status} ${errBody.slice(0, 300)}`,
        completed_at: new Date().toISOString(),
      });
      return Response.json({ error: `Apify start failed: ${apifyRes.status}` }, { status: 502 });
    }

    const apifyData = await apifyRes.json();
    const runId = apifyData?.data?.id;
    if (!runId) {
      await base44.entities.ScrapeRun.update(scrapeRun.id, {
        status: 'failed',
        error_message: 'Apify did not return a run id',
        completed_at: new Date().toISOString(),
      });
      return Response.json({ error: 'No run id from Apify' }, { status: 502 });
    }

    const updated = await base44.entities.ScrapeRun.update(scrapeRun.id, { run_id: runId });
    return Response.json(updated);

  } catch (err) {
    console.error('[startScrape] fatal:', err.message, err.stack);
    return Response.json({
      error: err.message,
      stack: err.stack,
      name: err.name
    }, { status: 500 });
  }
});