import { useState, useEffect } from "react";
import { Search, ExternalLink, TrendingUp, ShoppingBag, AlertCircle } from "lucide-react";
import { pettyCashApi } from "@/features/petty-cash/api/pettyCashApi";

/**
 * Market Price Intelligence Panel
 * Searches Google Shopping Bangladesh (BDT) via SerpAPI proxy endpoint.
 * @param {string} defaultQuery - Optional initial search query (e.g. request title)
 */
export function PriceLookupPanel({ defaultQuery = "" }) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  // Auto-search when defaultQuery is provided on mount
  useEffect(() => {
    if (defaultQuery && defaultQuery.trim()) {
      setQuery(defaultQuery);
      runSearch(defaultQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultQuery]);

  const runSearch = async (q) => {
    const term = (q || query).trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await pettyCashApi.priceLookup(term);
      setResults(data.results || []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to fetch prices. Try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") runSearch(query);
  };

  return (
    <div className="glass-panel p-5 rounded-2xl shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold Outfit leading-tight">Market Price Intel</h3>
          <p className="text-[10px] text-base-content/40 font-semibold uppercase tracking-wider">Google Shopping · BD · ৳</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. A4 paper ream, pen drive 32gb..."
            className="input input-bordered input-sm w-full pl-8 rounded-xl bg-base-100/60 border-base-content/10 text-xs focus:border-primary/40 placeholder:text-base-content/25"
          />
        </div>
        <button
          onClick={() => runSearch(query)}
          disabled={loading || !query.trim()}
          className="btn btn-primary btn-sm rounded-xl font-bold text-xs px-4 shrink-0"
        >
          {loading ? <span className="loading loading-spinner loading-xs" /> : "Search"}
        </button>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-3 items-center p-2.5 rounded-xl bg-base-300/30 animate-pulse">
              <div className="w-10 h-10 rounded-lg bg-base-300 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 bg-base-300 rounded w-3/4" />
                <div className="h-2 bg-base-300 rounded w-1/2" />
              </div>
              <div className="h-3 bg-base-300 rounded w-12 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex items-start gap-2 p-3 bg-error/10 rounded-xl border border-error/20 text-xs text-error">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && searched && results.length === 0 && (
        <div className="text-center py-6 space-y-2">
          <ShoppingBag className="w-8 h-8 text-base-content/15 mx-auto" />
          <p className="text-xs text-base-content/40 font-medium">No prices found for "{query}"</p>
          <p className="text-[10px] text-base-content/30">Try a shorter or more general term</p>
        </div>
      )}

      {/* Results list */}
      {!loading && results.length > 0 && (
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {results.map((item, idx) => (
            <a
              key={idx}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-2.5 rounded-xl bg-base-300/30 hover:bg-primary/5 border border-transparent hover:border-primary/15 transition-all duration-150 group"
            >
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded-lg bg-base-100 border border-base-content/10 overflow-hidden shrink-0 flex items-center justify-center">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-contain"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                ) : (
                  <ShoppingBag className="w-4 h-4 text-base-content/20" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-base-content leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                {item.store && (
                  <p className="text-[10px] text-base-content/40 font-medium mt-0.5 truncate">{item.store}</p>
                )}
              </div>

              {/* Price + link icon */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs font-extrabold text-primary whitespace-nowrap">
                  {item.price || "—"}
                </span>
                <ExternalLink className="w-3 h-3 text-base-content/20 group-hover:text-primary transition-colors" />
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Idle prompt */}
      {!loading && !error && !searched && (
        <div className="text-center py-4">
          <Search className="w-7 h-7 text-base-content/10 mx-auto mb-2" />
          <p className="text-[10px] text-base-content/30 font-medium">Search a product to see live BDT prices from Bangladeshi stores</p>
        </div>
      )}
    </div>
  );
}
