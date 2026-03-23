'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { ListingCard } from '@/components/ListingCard';
import Link from 'next/link';
import { formatSearchPreference } from '@/lib/search-preferences';

export default function ResultsPage() {
  const router = useRouter();
  const searchCriteria = useAppStore(state => state.searchCriteria);
  const listings = useAppStore(state => state.listings);
  const startSessionWithListing = useAppStore(state => state.startSessionWithListing);

  // Redirect to home if accessed directly without search
  useEffect(() => {
    if (!searchCriteria) {
      router.replace('/');
    }
  }, [searchCriteria, router]);

  if (!searchCriteria) return null;

  return (
    <main className="min-h-screen p-6 md:p-12 relative">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <Link href="/" className="inline-flex items-center text-sm font-medium text-blue-400 hover:text-blue-300 mb-4 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 lucide lucide-arrow-left"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              Back to search
            </Link>
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
              Found {listings.length} matches
            </h1>
            <p className="text-gray-400 mt-2 text-lg">
              for &ldquo;{searchCriteria.query}&rdquo;{' '}
              {searchCriteria.location && `in ${searchCriteria.location}`}
            </p>
            {searchCriteria.preferences.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {searchCriteria.preferences.map((preference) => (
                  <span
                    key={preference.key}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-blue-100"
                  >
                    {formatSearchPreference(preference)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 mb-4 lucide lucide-search-x"><path d="m13.5 8.5-5 5"/><path d="m8.5 8.5 5 5"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <h3 className="text-xl font-semibold text-gray-200">No properties found</h3>
            <p className="text-gray-400 mt-2 max-w-sm">
              We couldn&apos;t find any listings matching your exact criteria. Try
              broadening your search.
            </p>
            <Link href="/" className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors">
              Try new search
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                title={listing.title}
                rent={listing.rent}
                location={listing.location}
                bedrooms={listing.bedrooms}
                bathrooms={listing.bathrooms}
                sourceSite={listing.sourceSite}
                description={listing.description}
                attributes={listing.attributes}
                thumbnailUrl={listing.thumbnailUrl}
                onSelect={() => {
                  startSessionWithListing(listing);
                  router.push(`/prospect/${listing.id}`);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
