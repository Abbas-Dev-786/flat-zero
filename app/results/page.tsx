'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ListingCard } from '@/components/ListingCard';
import { formatSearchPreference } from '@/lib/search-preferences';
import type { SearchStreamEvent } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';

const TARGET_RESULTS = 5;
const SEARCH_DEADLINE_MS = 90_000;

function LoadingCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-48 animate-pulse bg-slate-100" />
      <div className="space-y-4 p-6">
        <div className="h-7 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Search failed';
}

export default function ResultsPage() {
  const router = useRouter();
  const searchCriteria = useAppStore((state) => state.searchCriteria);
  const searchRequestId = useAppStore((state) => state.searchRequestId);
  const searchStatusMessage = useAppStore((state) => state.searchStatusMessage);
  const searchError = useAppStore((state) => state.searchError);
  const listings = useAppStore((state) => state.listings);
  const isSearching = useAppStore((state) => state.isSearching);
  const appendListing = useAppStore((state) => state.appendListing);
  const setSearchStatusMessage = useAppStore((state) => state.setSearchStatusMessage);
  const setSearchError = useAppStore((state) => state.setSearchError);
  const finishSearch = useAppStore((state) => state.finishSearch);
  const startSessionWithListing = useAppStore((state) => state.startSessionWithListing);

  useEffect(() => {
    if (!searchCriteria) {
      router.replace('/');
    }
  }, [searchCriteria, router]);

  useEffect(() => {
    if (!searchCriteria || !isSearching || searchRequestId === 0) {
      return;
    }

    const abortController = new AbortController();
    let disposed = false;
    let timedOut = false;

    const handleEvent = (event: SearchStreamEvent) => {
      if (event.type === 'status') {
        setSearchStatusMessage(event.message);
        return;
      }

      if (event.type === 'listing') {
        appendListing(event.listing);
        return;
      }

      if (event.type === 'complete') {
        setSearchStatusMessage(
          event.total > 0
            ? `Found ${event.total} verified property detail pages.`
            : 'No verified property detail pages were found for this search.',
        );
        return;
      }

      setSearchError(event.error);
    };

    const runSearch = async () => {
      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        abortController.abort();
      }, SEARCH_DEADLINE_MS);

      try {
        setSearchError('');
        setSearchStatusMessage('Searching verified rental listing pages...');

        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(searchCriteria),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Search failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          while (true) {
            const lineBreakIndex = buffer.indexOf('\n');
            if (lineBreakIndex === -1) {
              break;
            }

            const line = buffer.slice(0, lineBreakIndex).trim();
            buffer = buffer.slice(lineBreakIndex + 1);

            if (!line) {
              continue;
            }

            handleEvent(JSON.parse(line) as SearchStreamEvent);
          }
        }

        const trailing = buffer.trim();
        if (trailing) {
          handleEvent(JSON.parse(trailing) as SearchStreamEvent);
        }
      } catch (error) {
        if (abortController.signal.aborted || disposed) {
          if (!disposed && timedOut) {
            setSearchError(
              'Search timed out while verifying real listing pages. Please try a broader query or a more specific neighborhood.',
            );
            setSearchStatusMessage('');
          }
          return;
        }

        setSearchError(getErrorMessage(error));
      } finally {
        window.clearTimeout(timeoutId);
        if (!disposed) {
          finishSearch();
        }
      }
    };

    void runSearch();

    return () => {
      disposed = true;
      abortController.abort();
    };
  }, [
    appendListing,
    finishSearch,
    isSearching,
    searchCriteria,
    searchRequestId,
    setSearchError,
    setSearchStatusMessage,
  ]);

  if (!searchCriteria) {
    return null;
  }

  const loadingCards = isSearching ? Math.max(0, TARGET_RESULTS - listings.length) : 0;

  return (
    <main className="relative min-h-screen p-6 md:p-12">
      <div className="absolute top-0 right-0 -z-10 h-[800px] w-[800px] rounded-full bg-blue-300/30 blur-[120px]" />

      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Link
              href="/"
              className="mb-4 inline-flex items-center text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
              Back to search
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Found {listings.length} verified matches
            </h1>
            <p className="mt-2 text-lg text-slate-600">
              for &ldquo;{searchCriteria.query}&rdquo;{' '}
              {searchCriteria.location && `in ${searchCriteria.location}`}
            </p>
            {searchStatusMessage && (
              <p className="mt-3 text-sm font-medium text-blue-600">{searchStatusMessage}</p>
            )}
            {searchCriteria.preferences.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {searchCriteria.preferences.map((preference) => (
                  <span
                    key={preference.key}
                    className="rounded-full border border-slate-200 bg-white shadow-sm px-3 py-1.5 text-sm text-slate-700"
                  >
                    {formatSearchPreference(preference)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {searchError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {searchError}
          </div>
        )}

        {listings.length === 0 && !isSearching ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm py-20 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-4 text-slate-300"
            >
              <path d="m13.5 8.5-5 5" />
              <path d="m8.5 8.5 5 5" />
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <h3 className="text-xl font-semibold text-slate-900">No verified properties found</h3>
            <p className="mt-2 max-w-sm text-slate-500">
              We filtered out generic search and category pages, so try broadening the
              query or changing the location.
            </p>
            <Link
              href="/"
              className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-500"
            >
              Try new search
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                title={listing.title}
                rent={listing.rent}
                location={listing.location}
                exactAddress={listing.exactAddress}
                bedrooms={listing.bedrooms}
                bathrooms={listing.bathrooms}
                sourceSite={listing.sourceSite}
                description={listing.description}
                attributes={listing.attributes}
                thumbnailUrl={listing.thumbnailUrl}
                contactPhone={listing.contactPhone}
                managerName={listing.managerName}
                detailConfidence={listing.detailConfidence}
                keyAmenities={listing.keyAmenities}
                verifiedDetailPage={listing.verifiedDetailPage}
                listingUrl={listing.listingUrl}
                onSelect={() => {
                  startSessionWithListing(listing);
                  router.push(`/prospect/${listing.id}`);
                }}
              />
            ))}
            {Array.from({ length: loadingCards }).map((_, index) => (
              <LoadingCard key={`loading-${index}`} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
