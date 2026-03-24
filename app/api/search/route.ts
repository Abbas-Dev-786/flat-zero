import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import {
  buildListingPatchFromExtraction,
  extractAvailableFromText,
  extractBathroomsFromText,
  extractBedroomsFromText,
  extractPhoneNumber,
  extractRentFromText,
  getSearchResultImage,
  getSearchResultText,
  getSearchResultTitle,
  getSearchResultUrl,
  getListingExtraction,
  getSourceSite,
  searchListings,
  toPlainTextSnippet,
} from '@/lib/firecrawl';
import type { Listing, SearchCriteria } from '@/lib/types';
import {
  normalizeSearchCriteria,
  preferenceToQueryText,
} from '@/lib/search-preferences';

function buildSearchQuery({
  query,
  location,
  maxBudget,
  bedrooms,
  preferences,
}: SearchCriteria) {
  const normalizedQuery = query.trim();
  const parts = [normalizedQuery];
  const lowered = normalizedQuery.toLowerCase();

  if (maxBudget && !/\b(?:under|below|max|budget)\b/i.test(normalizedQuery)) {
    parts.push(`under ${maxBudget}`);
  }

  if (bedrooms && !/\b\d+\s*(?:bed|bedroom|br)\b/i.test(normalizedQuery)) {
    parts.push(`${bedrooms} bedroom`);
  }

  if (!/\b(?:apartment|flat|condo|home|rental|rent)\b/i.test(normalizedQuery)) {
    parts.push('apartment rental listing');
  }

  for (const preference of preferences) {
    const preferenceText = preferenceToQueryText(preference).trim();
    if (preferenceText && !lowered.includes(preferenceText.toLowerCase())) {
      parts.push(preferenceText);
    }
  }

  return parts.join(' ');
}

function createListingId(url: string) {
  return createHash('sha1').update(url).digest('hex');
}

function inferPetPolicy(text: string) {
  if (!text) {
    return null;
  }

  if (/\b(?:pet-friendly|pets allowed|cats allowed|dogs allowed)\b/i.test(text)) {
    return 'Pet-friendly';
  }

  if (/\bno pets\b/i.test(text)) {
    return 'No pets';
  }

  if (/\bpet\b/i.test(text)) {
    return 'Ask landlord';
  }

  return null;
}

function normalizeListing(rawResult: Awaited<ReturnType<typeof searchListings>>[number], fallbackLocation?: string): Listing | null {
  const url = getSearchResultUrl(rawResult);
  if (!url) {
    return null;
  }

  const extracted = getListingExtraction(rawResult);
  const extractedPatch = buildListingPatchFromExtraction(extracted);
  const text = getSearchResultText(rawResult);

  const rent = extractedPatch.rent ?? extractRentFromText(text);
  const contactPhone = extractedPatch.contactPhone ?? extractPhoneNumber(text);
  const title = extractedPatch.title ?? getSearchResultTitle(rawResult) ?? 'Untitled listing';
  const location = extractedPatch.location ?? fallbackLocation ?? 'Location unavailable';

  return {
    id: createListingId(url),
    title,
    rent,
    location,
    bedrooms: extractedPatch.bedrooms ?? extractBedroomsFromText(text),
    bathrooms: extractedPatch.bathrooms ?? extractBathroomsFromText(text),
    petPolicy: extractedPatch.petPolicy ?? inferPetPolicy(text),
    availableFrom: extractedPatch.availableFrom ?? extractAvailableFromText(text),
    listingUrl: url,
    thumbnailUrl: extractedPatch.thumbnailUrl ?? getSearchResultImage(rawResult),
    contactPhone,
    description: toPlainTextSnippet(text, 260),
    sourceSite: getSourceSite(url),
    attributes: extractedPatch.attributes ?? {},
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Partial<SearchCriteria> | null;
    const criteria = normalizeSearchCriteria(body);

    if (!criteria) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const finalQuery = buildSearchQuery(criteria);
    const rawResults = await searchListings(finalQuery, criteria.location, 10);
    const listings = rawResults
      .map((result) => normalizeListing(result, criteria.location))
      .filter((listing): listing is Listing => listing !== null);

    return NextResponse.json({ listings });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to search listings right now';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
