import { NextResponse } from 'next/server';
import {
  buildListingPatchFromExtraction,
  buildPropertyDossier,
  buildSourceLink,
  dedupeSourceLinks,
  extractPhoneNumber,
  extractRentFromText,
  getListingExtraction,
  getSearchResultText,
  rentToNumber,
  researchListingWithAgent,
  scrapeListingUrl,
  searchResultsToSourceLinks,
  searchSupportingContext,
  summarizeSearchResults,
  type FirecrawlSearchResult,
} from '@/lib/firecrawl';
import type { LeverageData, ListingPatch, SourceLink } from '@/lib/types';

type ScrapeRequest = {
  listingUrl?: string;
  listingTitle?: string;
  location?: string;
  exactAddress?: string | null;
  managerName?: string | null;
  askingRent?: string | null;
  bedrooms?: number | null;
};

function buildComparableSummary(
  results: FirecrawlSearchResult[],
  areaLabel: string,
  askingRent?: string | null,
) {
  const rents = extractComparableRents(results);
  const summaryLines = summarizeSearchResults(results, 3);

  if (rents.length === 0) {
    return summaryLines ? `Comparable listings near ${areaLabel}:\n${summaryLines}` : null;
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

  return `Comparable listings near ${areaLabel} suggest a typical rent around ${averageRent}.${comparisonNote}${
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

  return `Public search results surfaced reviews, complaints, or management signals worth asking about:\n${summaryLines}`;
}

function buildNegotiationPoints({
  askingRent,
  comparableSummary,
  reputationSummary,
  dossierOverview,
  feesAndPolicies,
}: {
  askingRent?: string | null;
  comparableSummary: string | null;
  reputationSummary: string | null;
  dossierOverview: string | null;
  feesAndPolicies: string[];
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

  if (feesAndPolicies.length > 0) {
    points.push(
      `Clarify listed fees and policies early: ${feesAndPolicies.slice(0, 2).join('; ')}.`,
    );
  }

  if (reputationSummary) {
    points.push(
      'Ask direct follow-up questions about maintenance responsiveness, hidden fees, and lease terms because reputation-related search results were found.',
    );
  }

  if (dossierOverview) {
    points.push('Reference the specific advertised features so the landlord knows the tenant has done their homework.');
  }

  points.push('The tenant is serious, ready to move quickly, and can complete the process without delay.');
  points.push('The tenant can pay upfront if that helps secure a better monthly rate.');

  return points;
}

function buildComparableQuery({
  exactAddress,
  location,
  askingRent,
  bedrooms,
}: {
  exactAddress?: string | null;
  location: string;
  askingRent?: string | null;
  bedrooms?: number | null;
}) {
  return [
    exactAddress ? `apartments for rent near "${exactAddress}"` : `apartments for rent near ${location}`,
    bedrooms ? `${bedrooms} bedroom` : '',
    askingRent ? `around ${askingRent}` : '',
    'comparable rental listing',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildReputationQuery({
  managerName,
  exactAddress,
  listingTitle,
  location,
}: {
  managerName?: string | null;
  exactAddress?: string | null;
  listingTitle?: string | null;
  location: string;
}) {
  if (managerName) {
    return [`"${managerName}"`, 'reviews complaints property management'].join(' ');
  }

  return [
    `"${exactAddress ?? listingTitle ?? location}"`,
    'landlord reviews complaints property management building',
  ].join(' ');
}

function mergeListingPatchWithResearch(
  listingPatch: ListingPatch,
  sourceLinks: SourceLink[],
  dossier: LeverageData['dossier'],
  listingMarkdown: string,
) {
  const contactPhone =
    listingPatch.contactPhone ?? dossier?.contactPhone ?? extractPhoneNumber(listingMarkdown);

  return {
    ...listingPatch,
    description: listingPatch.description ?? dossier?.overview ?? listingPatch.description,
    exactAddress: listingPatch.exactAddress ?? dossier?.exactAddress ?? null,
    managerName: listingPatch.managerName ?? dossier?.managerName ?? null,
    petPolicy: listingPatch.petPolicy ?? dossier?.petPolicy ?? null,
    availableFrom: listingPatch.availableFrom ?? dossier?.availability ?? null,
    contactPhone,
    keyAmenities:
      listingPatch.keyAmenities && listingPatch.keyAmenities.length > 0
        ? listingPatch.keyAmenities
        : dossier?.keyAmenities ?? [],
    sourceLinks,
    verifiedDetailPage: true,
  } satisfies ListingPatch;
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

    const [listingResult, agentResult] = await Promise.allSettled([
      scrapeListingUrl(body.listingUrl),
      researchListingWithAgent({
        listingUrl: body.listingUrl,
        title: body.listingTitle,
        location: body.location,
        exactAddress: body.exactAddress,
      }),
    ]);

    const listingMarkdown =
      listingResult.status === 'fulfilled' ? listingResult.value.markdown ?? '' : '';
    const listingExtraction =
      listingResult.status === 'fulfilled'
        ? getListingExtraction(listingResult.value)
        : null;
    const baseListingLink = buildSourceLink(body.listingUrl, 'Canonical listing', 'listing');
    const listingPatch = buildListingPatchFromExtraction(listingExtraction, {
      sourceLinks: baseListingLink ? [baseListingLink] : [],
    });

    const dossier = buildPropertyDossier(
      listingExtraction,
      agentResult.status === 'fulfilled' ? agentResult.value : null,
      listingPatch.sourceLinks ?? [],
    );

    const exactAddress = dossier.exactAddress ?? body.exactAddress ?? listingPatch.exactAddress;
    const managerName = dossier.managerName ?? body.managerName ?? listingPatch.managerName;
    const comparableQuery = buildComparableQuery({
      exactAddress,
      location: body.location,
      askingRent: body.askingRent,
      bedrooms: body.bedrooms,
    });
    const reputationQuery = buildReputationQuery({
      managerName,
      exactAddress,
      listingTitle: body.listingTitle,
      location: body.location,
    });

    const [comparablesResult, reputationResult] = await Promise.allSettled([
      searchSupportingContext(comparableQuery, 5, body.location),
      searchSupportingContext(reputationQuery, 3, body.location),
    ]);

    const comparables =
      comparablesResult.status === 'fulfilled' ? comparablesResult.value : [];
    const reputationResults =
      reputationResult.status === 'fulfilled' ? reputationResult.value : [];

    const comparableSourceLinks = searchResultsToSourceLinks(
      comparables,
      'comparable',
      3,
    );
    const reputationSourceLinks = searchResultsToSourceLinks(
      reputationResults,
      'reputation',
      3,
    );

    const sourceLinks = dedupeSourceLinks([
      ...(listingPatch.sourceLinks ?? []),
      ...(dossier?.sourceLinks ?? []),
      ...comparableSourceLinks,
      ...reputationSourceLinks,
    ]);

    const areaLabel = exactAddress ?? body.location;
    const marketComparablesSummary = buildComparableSummary(
      comparables,
      areaLabel,
      body.askingRent,
    );
    const comparableRents = extractComparableRents(comparables);
    const landlordReputationSummary = buildReputationSummary(reputationResults);
    const feesAndPolicies = dossier?.feesAndPolicies.map(
      (fact) => `${fact.label}: ${fact.value}`,
    ) ?? [];

    const leverageData: LeverageData = {
      listingMarkdown,
      landlordReputationSummary,
      marketComparablesSummary,
      comparableRents,
      negotiationPoints: buildNegotiationPoints({
        askingRent: body.askingRent,
        comparableSummary: marketComparablesSummary,
        reputationSummary: landlordReputationSummary,
        dossierOverview: dossier?.overview ?? null,
        feesAndPolicies,
      }),
      contactPhone:
        listingPatch.contactPhone ??
        dossier?.contactPhone ??
        extractPhoneNumber(listingMarkdown),
      dossier: {
        ...dossier,
        sourceLinks,
      },
      sourceLinks,
    };

    return NextResponse.json({
      leverageData,
      listingPatch: mergeListingPatchWithResearch(
        listingPatch,
        sourceLinks,
        leverageData.dossier,
        listingMarkdown,
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to prepare leverage data right now';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
