import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Globe, Phone, Mail, Star, MapPin, XCircle, Building2, Download, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LeadScraper() {
  const [niche, setNiche] = useState('');
  const [city, setCity] = useState('');
  const [maxResults, setMaxResults] = useState(50);
  const [filterNiche, setFilterNiche] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const queryClient = useQueryClient();

  const [scrapeRunId, setScrapeRunId] = useState(null);
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [scrapeError, setScrapeError] = useState(null);
  const [scrapeResults, setScrapeResults] = useState(null);
  const pollRef = useRef(null);

  const { data: prospects = [] } = useQuery({
    queryKey: ['prospects'],
    queryFn: () => base44.entities.Prospect.list('-scraped_at', 5000),
  });

  useEffect(() => {
    if (scrapeRunId && scrapeStatus === 'running') {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const res = await base44.functions.invoke('checkAndImportRun', { scrape_run_id: scrapeRunId });
          const result = res.data;
          if (result.status === 'complete') {
            setScrapeResults({ inserted: result.inserted, skipped: result.skipped, error_message: result.error_message });
            queryClient.invalidateQueries({ queryKey: ['prospects'] });
            toast.success(`Scrape complete! ${result.inserted} leads inserted.`);
            setScrapeStatus('complete');
            clearInterval(pollRef.current);
          } else if (result.status === 'failed') {
            setScrapeError(result.error_message);
            toast.error(`Scrape failed: ${result.error_message}`);
            setScrapeStatus('failed');
            clearInterval(pollRef.current);
          }
        } catch (e) {
          setScrapeError(e.message);
          setScrapeStatus('failed');
          clearInterval(pollRef.current);
        }
      }, 15000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [scrapeRunId, scrapeStatus, queryClient]);

  const handleScrape = async () => {
    if (!niche.trim() || !city.trim()) return;
    setScrapeStatus('running');
    setScrapeRunId(null);
    setScrapeError(null);
    setScrapeResults(null);
    try {
      const res = await base44.functions.invoke('startScrape', {
        niche: niche.trim(),
        city: city.trim(),
        max_results: Number(maxResults),
      });
      setScrapeRunId(res.data.id);
      toast.info('Scraping initiated. Results will appear automatically…');
    } catch (e) {
      setScrapeError(e.message);
      setScrapeStatus('failed');
      toast.error(`Failed to start scrape: ${e.message}`);
    }
  };

  const isScraping = scrapeStatus === 'running';
  const location = useLocation();
  const navLinks = [
    { to: '/', label: 'Lead Scraper', icon: <Search className="w-4 h-4" /> },
  ];

  // Unique niches across the whole prospect set, used to render the
  // filter chips. Empty string == "All" — clears the filter.
  const niches = Array.from(new Set(prospects.map(p => p.niche).filter(Boolean))).sort();
  const filtered = filterNiche
    ? prospects.filter(p => p.niche === filterNiche)
    : prospects;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const displayed = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Flip the Qualified flag on a single Prospect and re-fetch the table.
  // Optimistic UI not used here because the table only re-renders on
  // query invalidation — keeping it simple.
  async function toggleQualified(p) {
    try {
      await base44.entities.Prospect.update(p.id, { qualified: !p.qualified });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    } catch (e) {
      toast.error(`Couldn't update lead: ${e.message}`);
    }
  }

  const exportCSV = (rows, filename) => {
    const headers = ['Name', 'Phone', 'Email', 'Website', 'Address', 'Rating', 'Reviews', 'Niche', 'City', 'Has Website', 'Qualified'];
    const lines = [headers.join(','), ...rows.map(p => [
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.phone || ''}"`,
      `"${p.email || ''}"`,
      `"${p.website || ''}"`,
      `"${(p.address || '').replace(/"/g, '""')}"`,
      p.rating ?? '',
      p.review_count ?? '',
      `"${p.niche || ''}"`,
      `"${p.city || ''}"`,
      p.has_website ? 'Yes' : 'No',
      p.qualified ? 'Yes' : 'No',
    ].join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen" style={{ background: '#070d1a' }}>

      {/* Top Nav */}
      <nav style={{ background: '#0d1526', borderBottom: '1px solid #1e2d4a' }} className="px-6 py-3 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#ea580c' }}>
            <Search className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">LeadScraper</span>
        </div>
        <div className="flex items-center gap-1">
          {navLinks.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === l.to
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              style={location.pathname === l.to ? { background: 'rgba(234,88,12,0.25)', color: '#fb923c' } : {}}
            >
              {l.icon}{l.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Hero Search Card */}
        <div
          className="rounded-2xl p-8 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1a0a02 0%, #2d1206 50%, #1a0a02 100%)', border: '1px solid #7c2d12' }}
        >
          {/* Decorative circles */}
          <div className="absolute top-4 left-8 w-24 h-24 rounded-full opacity-10" style={{ background: '#ea580c', filter: 'blur(20px)' }} />
          <div className="absolute bottom-4 right-12 w-32 h-32 rounded-full opacity-10" style={{ background: '#f97316', filter: 'blur(24px)' }} />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4" style={{ background: 'rgba(234,88,12,0.2)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.3)' }}>
              ✦ AI-Powered Business Search
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Find your next clients</h1>
            <p className="mb-6" style={{ color: '#94a3b8' }}>Search any industry and location to discover businesses and their contact details instantly.</p>

            <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
              <div className="flex-1 flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #7c2d12' }}>
                <Building2 className="w-4 h-4 shrink-0" style={{ color: '#fb923c' }} />
                <input
                  className="bg-transparent flex-1 outline-none text-sm text-white placeholder-slate-500"
                  placeholder="Industry (e.g. Plumbing, Dental…)"
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScrape()}
                />
              </div>
              <div className="flex-1 flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #7c2d12' }}>
                <MapPin className="w-4 h-4 shrink-0" style={{ color: '#fb923c' }} />
                <input
                  className="bg-transparent flex-1 outline-none text-sm text-white placeholder-slate-500"
                  placeholder="Location (e.g. Miami, FL)"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScrape()}
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #7c2d12', minWidth: '90px' }}>
                <input
                  type="number"
                  min={1}
                  max={500}
                  className="bg-transparent w-full outline-none text-sm text-white placeholder-slate-500 text-center"
                  placeholder="Max"
                  value={maxResults}
                  onChange={e => setMaxResults(e.target.value)}
                />
              </div>
              <button
                onClick={handleScrape}
                disabled={isScraping || !niche.trim() || !city.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: isScraping ? '#c2410c' : '#ea580c' }}
              >
                {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isScraping ? 'Scraping…' : 'Find Leads'}
              </button>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        {scrapeStatus && (
          <div className={`rounded-xl px-5 py-4 text-sm flex items-start gap-3 ${
            scrapeStatus === 'failed'   ? 'bg-red-950 border border-red-800 text-red-300' :
            scrapeStatus === 'complete' ? 'bg-emerald-950 border border-emerald-800 text-emerald-300' :
            'border text-orange-300'
          }`} style={scrapeStatus === 'running' ? { background: 'rgba(234,88,12,0.1)', borderColor: 'rgba(234,88,12,0.3)' } : {}}>
            {scrapeStatus === 'running' && <Loader2 className="w-4 h-4 animate-spin mt-0.5 shrink-0" />}
            {scrapeStatus === 'complete' && scrapeResults && (
              <div>
                <strong>{scrapeResults.inserted}</strong> leads inserted · <strong>{scrapeResults.skipped}</strong> skipped (duplicates / no ID)
                {scrapeResults.error_message && (
                  <details className="mt-1"><summary className="cursor-pointer opacity-70">Write errors</summary>
                    <p className="mt-1 text-xs opacity-70">{scrapeResults.error_message}</p>
                  </details>
                )}
              </div>
            )}
            {scrapeStatus === 'running' && <span>Scraping in progress, checking every 15 seconds…</span>}
            {scrapeStatus === 'failed' && <span className="flex items-center gap-2"><XCircle className="w-4 h-4 shrink-0" /> Error: {scrapeError}</span>}
          </div>
        )}

        {/* Prospects Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1526', border: '1px solid #1e2d4a' }}>
          <div className="flex items-center justify-between px-5 py-4 gap-3" style={{ borderBottom: '1px solid #1e2d4a' }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <h2 className="text-white font-semibold shrink-0">Prospects</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold shrink-0" style={{ background: 'rgba(234,88,12,0.2)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.3)' }}>
                {filtered.length.toLocaleString()}
              </span>
              {/* Niche filter chips. Empty filterNiche == "All". Auto-built
                  from the unique niches in the current Prospect set. */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => { setFilterNiche(''); setPage(1); }}
                  className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                  style={
                    filterNiche === ''
                      ? { background: 'rgba(234,88,12,0.25)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.5)' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid #1e2d4a' }
                  }
                >
                  All
                </button>
                {niches.map(n => (
                  <button
                    key={n}
                    onClick={() => { setFilterNiche(n); setPage(1); }}
                    className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                    style={
                      filterNiche === n
                        ? { background: 'rgba(234,88,12,0.25)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.5)' }
                        : { background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid #1e2d4a' }
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => exportCSV(displayed, `leads-page${page}.csv`)}
                disabled={displayed.length === 0}
                title="Export this page to CSV"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: 'rgba(234,88,12,0.2)', border: '1px solid rgba(234,88,12,0.4)', color: '#fb923c' }}
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button
                onClick={() => exportCSV(filtered, `leads-all.csv`)}
                disabled={filtered.length === 0}
                title="Export ALL leads to CSV"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
              >
                <Download className="w-3.5 h-3.5" /> Export All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', color: '#4a6fa5' }} className="text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3 w-10">
                    <CheckCircle2 className="w-3.5 h-3.5 inline" />
                  </th>
                  <th className="text-left px-5 py-3">Business</th>
                  <th className="text-left px-5 py-3">Contact</th>
                  <th className="text-left px-5 py-3">Address</th>
                  <th className="text-left px-5 py-3">Rating</th>
                  <th className="text-left px-5 py-3">Niche / City</th>
                  <th className="text-left px-5 py-3">Website</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center" style={{ color: '#4a6fa5' }}>
                      No prospects yet. Run a scrape above.
                    </td>
                  </tr>
                )}
                {displayed.map((p, i) => (
                  <tr
                    key={p.id}
                    style={{
                      borderTop: '1px solid #1a2640',
                      background: p.qualified ? 'rgba(34, 197, 94, 0.06)' : undefined,
                    }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-5 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={!!p.qualified}
                        onChange={() => toggleQualified(p)}
                        title={p.qualified ? "Mark as not yet contacted" : "Mark as already contacted"}
                        className="w-4 h-4 rounded cursor-pointer accent-orange-500"
                      />
                    </td>
                    <td className="px-5 py-3 font-medium text-white max-w-[180px] truncate">{p.name}</td>
                    <td className="px-5 py-3" style={{ color: '#94a3b8' }}>
                      <div className="flex flex-col gap-0.5">
                        {p.phone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" style={{ color: '#f97316' }} />{p.phone}</span>}
                        {p.email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" style={{ color: '#f97316' }} />{p.email}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 max-w-[200px]" style={{ color: '#64748b' }}>
                      {p.address && <span className="flex items-start gap-1.5"><MapPin className="w-3 h-3 mt-0.5 shrink-0" style={{ color: '#f97316' }} />{p.address}</span>}
                    </td>
                    <td className="px-5 py-3">
                      {p.rating != null && (
                        <span className="flex items-center gap-1 font-medium" style={{ color: '#fbbf24' }}>
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {p.rating} <span className="font-normal" style={{ color: '#4a6fa5' }}>({p.review_count})</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white">{p.niche}</span>
                        <span className="text-xs" style={{ color: '#4a6fa5' }}>{p.city}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {p.has_website ? (
                        <a href={p.website} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-1.5 hover:underline" style={{ color: '#f97316' }}>
                          <Globe className="w-3 h-3" /> Visit
                        </a>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5', border: '1px solid #1e2d4a' }}>No site</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #1e2d4a' }}>
              <span className="text-sm" style={{ color: '#4a6fa5' }}>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm rounded-lg transition-colors disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #7c2d12', color: '#94a3b8' }}
                >Prev</button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm rounded-lg transition-colors disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #7c2d12', color: '#94a3b8' }}
                >Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}