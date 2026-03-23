import { NextResponse } from 'next/server';
import {
  buildListingPatchFromExtraction,
  extractPhoneNumber,
  extractRentFromText,
  getListingExtraction,
  getSearchResultText,
  rentToNumber,
  scrapeListingUrl,
  searchSupportingContext,
  summarizeSearchResults,
  type FirecrawlSearchResult,
} from '@/lib/firecrawl';
import type { LeverageData } from '@/lib/types';

type ScrapeRequest = {
  listingUrl?: string;
  location?: string;
  askingRent?: string | null;
};

function buildComparableSummary(
  results: FirecrawlSearchResult[],
  location: string,
  askingRent?: string | null,
) {
  const rents = extractComparableRents(results);

  const summaryLines = summarizeSearchResults(results, 3);

  if (rents.length === 0) {
    return summaryLines
      ? `Comparable listings near ${location}:\n${summaryLines}`
      : null;
  }

  const averageRent = Math.round(
    rents.reduce((total, rent) => total + rent, 0) / rents.length,
  );

  const askingRentNumber = rentToNumber(askingRent ?? null);
  const comparisonNote =
    askingRentNumber && averageRent
      ? askingRentNumber > averageRent
        ? ` The current asking rent appears to be above the comparable average of about ${averageRent}.`
        : ` The current asking rent appears to be in line with comparable inventory around ${averageRent}.`
      : '';

  return `Comparable listings near ${location} suggest a typical rent around ${averageRent}.${comparisonNote}${
    summaryLines ? `\n${summaryLines}` : ''
  }`;
}

function extractComparableRents(results: FirecrawlSearchResult[]) {
  return results
    .map((result) => rentToNumber(extractRentFromText(getSearchResultText(result))))
    .filter((rent): rent is number => rent !== null);
}

function buildReputationSummary(results: FirecrawlSearchResult[]) {
  const summaryLines = summarizeSearchResults(results, 3);

  if (!summaryLines) {
    return null;
  }

  return `Public search results surfaced related reviews or complaints to keep in mind as follow-up questions:\n${summaryLines}`;
}

function buildNegotiationPoints({
  askingRent,
  comparableSummary,
  reputationSummary,
}: {
  askingRent?: string | null;
  comparableSummary: string | null;
  reputationSummary: string | null;
}) {
  const points: string[] = [];

  if (comparableSummary) {
    points.push(
      'Use nearby comparable listings to benchmark whether the asking rent is fully justified for the area.',
    );
  }

  if (askingRent) {
    points.push(
      `Offer flexibility on lease length in exchange for a discount from the current asking rent of ${askingRent}.`,
    );
  }

  if (reputationSummary) {
    points.push(
      'Ask direct follow-up questions about maintenance responsiveness, hidden fees, and lease terms because reputation-related search results were found.',
    );
  }

  points.push('The tenant is serious, ready to move quickly, and can complete the process without delay.');
  points.push('The tenant can pay upfront if that helps secure a better monthly rate.');

  return points;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as ScrapeRequest | null;

    if (!body?.listingUrl || !body?.location) {
      return NextResponse.json(
        { error: 'listingUrl and location are required' },
        { status: 400 },
      );
    }

    const comparableQuery = [
      `apartments for rent near ${body.location}`,
      body.askingRent ? `around ${body.askingRent}` : '',
      'comparable listing',
    ]
      .filter(Boolean)
      .join(' ');

    const reputationQuery = [
      `"${body.location}"`,
      'landlord reviews complaints property management building',
    ].join(' ');

    const [listingResult, comparablesResult, reputationResult] =
      await Promise.allSettled([
        scrapeListingUrl(body.listingUrl),
        searchSupportingContext(comparableQuery, 5),
        searchSupportingContext(reputationQuery, 3),
      ]);

    const listingMarkdown =
      listingResult.status === 'fulfilled' ? listingResult.value.markdown ?? '' : '';
    const listingExtraction =
      listingResult.status === 'fulfilled'
        ? getListingExtraction(listingResult.value)
        : null;
    const listingPatch = buildListingPatchFromExtraction(listingExtraction);
    const contactPhone = listingPatch.contactPhone ?? extractPhoneNumber(listingMarkdown);

    const comparables =
      comparablesResult.status === 'fulfilled' ? comparablesResult.value : [];
    const reputationResults =
      reputationResult.status === 'fulfilled' ? reputationResult.value : [];

    const marketComparablesSummary = buildComparableSummary(
      comparables,
      body.location,
      body.askingRent,
    );
    const comparableRents = extractComparableRents(comparables);
    const landlordReputationSummary = buildReputationSummary(reputationResults);

    const leverageData: LeverageData = {
      listingMarkdown,
      landlordReputationSummary,
      marketComparablesSummary,
      comparableRents,
      negotiationPoints: buildNegotiationPoints({
        askingRent: body.askingRent,
        comparableSummary: marketComparablesSummary,
        reputationSummary: landlordReputationSummary,
      }),
      contactPhone,
    };

    return NextResponse.json({
      leverageData,
      listingPatch: contactPhone
        ? {
            ...listingPatch,
            contactPhone,
          }
        : listingPatch,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to prepare leverage data right now';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
