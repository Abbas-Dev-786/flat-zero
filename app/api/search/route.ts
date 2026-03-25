import { NextResponse } from 'next/server';
import {
  DEFAULT_ENRICHED_LISTING_TARGET,
  discoverCanonicalListings,
} from '@/lib/firecrawl';
import type { SearchCriteria, SearchStreamEvent } from '@/lib/types';
import { normalizeSearchCriteria } from '@/lib/search-preferences';

const encoder = new TextEncoder();

function encodeEvent(event: SearchStreamEvent) {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Partial<SearchCriteria> | null;
    const criteria = normalizeSearchCriteria(body);

    if (!criteria) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: SearchStreamEvent) => {
          try {
            controller.enqueue(encodeEvent(event));
          } catch (e) {
            // Stream might be closed if client disconnected
          }
        };

        void (async () => {
          try {
            const listings = await discoverCanonicalListings(criteria, {
              targetCount: DEFAULT_ENRICHED_LISTING_TARGET,
              onEvent: send,
            });

            send({
              type: 'complete',
              total: listings.length,
            });
          } catch (error) {
            send({
              type: 'error',
              error:
                error instanceof Error
                  ? error.message
                  : 'Unable to search listings right now',
            });
          } finally {
            try {
              controller.close();
            } catch (e) {
              // Ignore if already closed
            }
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to search listings right now';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
