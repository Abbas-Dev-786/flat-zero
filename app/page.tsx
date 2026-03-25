'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { parseSearchCriteriaFromQuery } from '@/lib/search-preferences';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const beginSearch = useAppStore(state => state.beginSearch);
  const isSearching = useAppStore(state => state.isSearching);

  const submitSearch = async () => {
    if (!query.trim()) return;

    const criteria = parseSearchCriteriaFromQuery(query);
    beginSearch(criteria);
    router.push('/results');
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitSearch();
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-50">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-300/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-300/20 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-sm text-slate-600 mb-8 transition-all hover:shadow-md hover:-translate-y-0.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
          </span>
          Powered by ElevenLabs & Firecrawl
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 text-transparent bg-clip-text">
          AI Apartment Hunter
        </h1>
        <p className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl leading-relaxed">
          Describe your perfect apartment in plain English. Our AI will scour the web, synthesize market leverage, and <span className="text-blue-600 font-semibold relative inline-block after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-200 hover:after:bg-blue-400 transition-all cursor-default">negotiate with the landlord on your behalf</span> over voice.
        </p>

        <form onSubmit={handleSearch} className="w-full relative group rounded-[2.5rem] mt-2 transition-transform duration-300 hover:scale-[1.01]">
          {/* Animated Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition duration-700 pointer-events-none" />
          
          <div className="relative bg-white/90 backdrop-blur-2xl shadow-2xl shadow-blue-900/5 ring-1 ring-slate-200 rounded-[2.5rem] flex flex-col sm:flex-row items-center p-3 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:shadow-blue-500/10 transition-all duration-300 overflow-hidden">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 2 bed flat in London under £2,000, pet-friendly..."
              className="w-full min-h-[60px] max-h-[150px] bg-transparent text-slate-900 px-6 py-4 placeholder:text-slate-400 resize-none outline-none text-lg leading-relaxed focus:placeholder:text-slate-300 transition-colors"
              disabled={isSearching}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button 
              type="submit"
              disabled={isSearching || !query.trim()}
              className="mt-2 sm:mt-0 w-full sm:w-auto self-stretch sm:self-auto shrink-0 bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-[1.75rem] font-semibold transition-all active:scale-[0.98] shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 group/btn"
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Find Apartments</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 transition-all"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </>
              )}
            </button>
          </div>
        </form>

        <div className={`mt-6 h-6 transition-all duration-300 ${isSearching ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
          {isSearching && (
            <p className="text-sm font-medium text-slate-500 animate-pulse flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
              Searching rental sites and verifying property details...
            </p>
          )}
        </div>
        
      </div>
    </main>
  );
}
