'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { parseSearchCriteriaFromQuery } from '@/lib/search-preferences';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [errorText, setErrorText] = useState('');
  
  const setSearchCriteria = useAppStore(state => state.setSearchCriteria);
  const setListings = useAppStore(state => state.setListings);
  const setIsSearching = useAppStore(state => state.setIsSearching);
  const isSearching = useAppStore(state => state.isSearching);

  const submitSearch = async () => {
    if (!query.trim()) return;

    setErrorText('');
    setIsSearching(true);

    const criteria = parseSearchCriteriaFromQuery(query);

    setSearchCriteria(criteria);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await res.json();
      setListings(data.listings);
      router.push('/results');
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while searching.',
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitSearch();
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/20 blur-[120px] rounded-full point-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 blur-[100px] rounded-full point-events-none" />
      
      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-blue-200 mb-8 backdrop-blur-sm shadow-xl hover:bg-white/10 transition-colors">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Powered by ElevenLabs & Firecrawl
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-white to-gray-400 text-transparent bg-clip-text">
          AI Apartment Hunter
        </h1>
        <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl">
          Describe your perfect apartment in plain English. Our AI will scour the web, synthesize market leverage, and <span className="text-blue-400 font-semibold">negotiate with the landlord on your behalf</span> over voice.
        </p>

        <form onSubmit={handleSearch} className="w-full relative group shadow-2xl shadow-blue-900/10 rounded-2xl">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[18px] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
          <div className="relative bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center p-2 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 2 bed flat in London under £2,000, pet-friendly..."
              className="w-full min-h-[60px] max-h-[150px] bg-transparent text-white px-4 py-4 placeholder:text-gray-500 resize-none outline-none text-lg"
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
              className="mt-2 sm:mt-0 w-full sm:w-auto self-stretch sm:self-auto shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-semibold transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Searching the web...
                </>
              ) : (
                'Find Apartments'
              )}
            </button>
          </div>
        </form>

        {isSearching && (
          <p className="mt-4 text-sm text-blue-200/80">
            Searching rental sites, scraping listing details, and preparing a shortlist...
          </p>
        )}
        
        {errorText && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {errorText}
          </div>
        )}
      </div>
    </main>
  );
}
