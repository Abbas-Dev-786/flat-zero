'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CallStatusPanel } from '@/components/CallStatusPanel';
import { LeveragePanel } from '@/components/LeveragePanel';
import { getDisplayableAttributes } from '@/lib/search-preferences';
import { useAppStore } from '@/store/useAppStore';

type PageProps = {
  params: Promise<{ id: string }>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export default function ProspectPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const currentSession = useAppStore((state) => state.currentSession);
  const searchCriteria = useAppStore((state) => state.searchCriteria);
  const userQuestions = useAppStore((state) => state.userQuestions);
  const isScrapingDetails = useAppStore((state) => state.isScrapingDetails);
  const setIsScrapingDetails = useAppStore((state) => state.setIsScrapingDetails);
  const setUserQuestions = useAppStore((state) => state.setUserQuestions);
  const updateSessionLeverage = useAppStore((state) => state.updateSessionLeverage);
  const mergeListingData = useAppStore((state) => state.mergeListingData);
  const updateCallState = useAppStore((state) => state.updateCallState);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [scrapeError, setScrapeError] = useState('');
  const [callError, setCallError] = useState('');

  useEffect(() => {
    if (!currentSession || currentSession.listing.id !== id) {
      router.replace('/');
    }
  }, [currentSession, id, router]);

  useEffect(() => {
    const prefilledPhone =
      currentSession?.leverageData?.contactPhone ?? currentSession?.listing.contactPhone ?? '';

    if (prefilledPhone && !phoneNumber) {
      setPhoneNumber(prefilledPhone);
    }
  }, [
    currentSession?.leverageData?.contactPhone,
    currentSession?.listing.contactPhone,
    phoneNumber,
  ]);

  if (!currentSession || currentSession.listing.id !== id) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
          <h1 className="text-2xl font-semibold text-white">Restoring your session...</h1>
          <p className="mt-3 text-sm text-gray-400">
            This page depends on the in-browser session. We&apos;re sending you back to
            search so you can pick a property again.
          </p>
        </div>
      </main>
    );
  }

  const { listing, leverageData, callState } = currentSession;
  const leverageReady = Boolean(leverageData);
  const isCalling =
    callState.status === 'initiating' || callState.status === 'in-progress';
  const displayableAttributes = getDisplayableAttributes(listing.attributes);

  const handleQuestionChange = (index: number, value: string) => {
    const nextQuestions = [...userQuestions];
    nextQuestions[index] = value;
    setUserQuestions(nextQuestions);
  };

  const handleQuestionRemove = (index: number) => {
    setUserQuestions(userQuestions.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleResearch = async () => {
    setIsScrapingDetails(true);
    setScrapeError('');

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingUrl: listing.listingUrl,
          location: listing.location,
          askingRent: listing.rent,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to research this property');
      }

      updateSessionLeverage(payload.leverageData);
      if (payload.listingPatch) {
        mergeListingData(listing.id, payload.listingPatch);
      }

      const discoveredPhone =
        payload.listingPatch?.contactPhone ?? payload.leverageData?.contactPhone;

      if (discoveredPhone) {
        setPhoneNumber((currentPhone) => currentPhone || discoveredPhone);
      }
    } catch (error) {
      setScrapeError(getErrorMessage(error));
    } finally {
      setIsScrapingDetails(false);
    }
  };

  const handleCall = async () => {
    if (!phoneNumber || !leverageReady) {
      return;
    }

    setCallError('');
    updateCallState({
      status: 'initiating',
      callId: null,
      summary: null,
      transcript: null,
      questionsAnswered: {},
      viewingScheduled: null,
    });

    try {
      const response = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhoneNumber: phoneNumber,
          propertyAddress: `${listing.title}, ${listing.location}`,
          askingRent: listing.rent ?? 'Price on request',
          listingDetails:
            leverageData?.listingMarkdown || `${listing.title}\n${listing.description}`,
          leveragePoints: leverageData?.negotiationPoints ?? [],
          userQuestions: userQuestions.filter((question) => question.trim()),
          comparableRents: leverageData?.comparableRents ?? [],
          preferences: searchCriteria?.preferences ?? [],
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to start the call');
      }

      updateCallState({
        status: 'initiating',
        callId: payload.callId,
        summary: null,
        transcript: null,
        questionsAnswered: {},
        viewingScheduled: null,
      });
    } catch (error) {
      setCallError(getErrorMessage(error));
      updateCallState({ status: 'failed' });
    }
  };

  return (
    <main className="min-h-screen overflow-hidden px-6 py-10 md:px-12">
      <div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_55%)]" />
      <div className="absolute -left-24 bottom-0 -z-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="mx-auto max-w-6xl">
        <Link
          href="/results"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-300 transition-colors hover:text-white"
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
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Back to results
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="space-y-8">
            <section className="rounded-[2rem] border border-white/10 bg-white/6 p-7 backdrop-blur-xl">
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-blue-300/80">
                Section 1
              </p>
              <div className="mt-4 flex flex-col gap-4 border-b border-white/10 pb-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                      {listing.title}
                    </h1>
                    <p className="mt-2 text-base text-gray-300">{listing.location}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-blue-200/80">
                      Asking Rent
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-white">
                      {listing.rent ?? 'Price on request'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-gray-300">
                  {listing.bedrooms !== null && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      {listing.bedrooms} bed
                    </span>
                  )}
                  {listing.bathrooms !== null && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      {listing.bathrooms} bath
                    </span>
                  )}
                  {listing.petPolicy && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      {listing.petPolicy}
                    </span>
                  )}
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    via {listing.sourceSite}
                  </span>
                </div>

                {displayableAttributes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {displayableAttributes.slice(0, 6).map((attribute) => (
                      <span
                        key={attribute.key}
                        className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100"
                      >
                        {attribute.displayText}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
                <div>
                  <h2 className="text-lg font-semibold text-white">Property summary</h2>
                  <p className="mt-3 text-sm leading-7 text-gray-300">
                    {listing.description || 'No listing summary was available from the search.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                    Listing details
                  </p>
                  <div className="mt-4 space-y-3">
                    <p>
                      <span className="text-gray-500">Available from:</span>{' '}
                      {listing.availableFrom ?? 'Ask landlord'}
                    </p>
                    <p>
                      <span className="text-gray-500">Phone:</span>{' '}
                      {listing.contactPhone ?? 'Will scrape or enter manually'}
                    </p>
                    <a
                      href={listing.listingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-blue-300 transition-colors hover:text-white"
                    >
                      Open original listing
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 17 17 7" />
                        <path d="M7 7h10v10" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/6 p-7 backdrop-blur-xl">
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-blue-300/80">
                Section 2
              </p>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Your questions</h2>
                  <p className="mt-2 text-sm text-gray-400">
                    Tweak the brief before the agent calls the landlord.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUserQuestions([...userQuestions, ''])}
                  className="rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200 transition-colors hover:bg-blue-500/20 hover:text-white"
                >
                  Add question
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {userQuestions.map((question, index) => (
                  <div
                    key={`${index}-${question}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"
                  >
                    <input
                      type="text"
                      value={question}
                      onChange={(event) =>
                        handleQuestionChange(index, event.target.value)
                      }
                      className="flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-gray-500"
                      placeholder="Add a question for the landlord"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuestionRemove(index)}
                      className="rounded-full bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {(leverageReady || isScrapingDetails) && (
              <LeveragePanel data={leverageData} isLoading={isScrapingDetails} />
            )}

            {scrapeError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {scrapeError}
              </div>
            )}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
            <section className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6 shadow-2xl backdrop-blur-xl">
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-blue-300/80">
                Section 3
              </p>
              <h2 className="mt-4 text-2xl font-semibold text-white">Launch the call</h2>
              <p className="mt-3 text-sm leading-6 text-gray-400">
                Research the listing first, then send the voice agent in with the
                property details, leverage points, and your custom questions.
              </p>

              <div className="mt-6 space-y-4">
                <button
                  type="button"
                  onClick={handleResearch}
                  disabled={isScrapingDetails}
                  className="w-full rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isScrapingDetails
                    ? 'Researching listing, comparables, and reputation...'
                    : leverageReady
                      ? 'Refresh research brief'
                      : 'Research & prepare agent'}
                </button>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <label className="block text-xs uppercase tracking-[0.18em] text-gray-400">
                    Landlord phone number
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="+1 555 123 4567"
                    className="mt-3 w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                  />
                  {!phoneNumber && (
                    <p className="mt-3 text-xs text-amber-300">
                      No phone number was found yet. You can paste one manually once you
                      have it.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCall}
                  disabled={!leverageReady || !phoneNumber || isCalling}
                  className="w-full rounded-2xl bg-indigo-600 px-4 py-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {callState.status === 'initiating'
                    ? 'Dialing landlord...'
                    : 'Call landlord now'}
                </button>

                {!leverageReady && (
                  <p className="text-xs text-gray-500">
                    Complete the research step before launching the call.
                  </p>
                )}

                {callError && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {callError}
                  </div>
                )}
              </div>
            </section>

            {callState.status !== 'idle' && (
              <CallStatusPanel
                key={callState.callId ?? callState.status}
                onRetry={handleCall}
              />
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
