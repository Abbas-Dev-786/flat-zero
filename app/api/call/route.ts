import { NextResponse } from 'next/server';
import { rentToNumber } from '@/lib/firecrawl';
import { createOutboundCall } from '@/lib/elevenlabs';
import type { SearchPreference } from '@/lib/types';

type CallRequest = {
  toPhoneNumber?: string;
  propertyAddress?: string;
  askingRent?: string;
  listingDetails?: string;
  leveragePoints?: string[];
  userQuestions?: string[];
  comparableRents?: number[];
  preferences?: SearchPreference[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as CallRequest | null;

    if (
      !body?.toPhoneNumber ||
      !body.propertyAddress ||
      !body.askingRent ||
      !body.listingDetails ||
      !Array.isArray(body.leveragePoints) ||
      !Array.isArray(body.userQuestions) ||
      !Array.isArray(body.comparableRents) ||
      !Array.isArray(body.preferences)
    ) {
      return NextResponse.json(
        { error: 'Missing required call parameters' },
        { status: 400 },
      );
    }

    const listingPrice = rentToNumber(body.askingRent);

    if (!listingPrice) {
      return NextResponse.json(
        {
          error:
            'Unable to determine the listing price for negotiation. Please ensure the asking rent is available before calling.',
        },
        { status: 400 },
      );
    }

    const callResult = await createOutboundCall({
      toPhoneNumber: body.toPhoneNumber,
      propertyAddress: body.propertyAddress,
      listingPrice,
      comparables: body.comparableRents,
      listingDetails: body.listingDetails,
      leveragePoints: body.leveragePoints,
      userQuestions: body.userQuestions,
      preferences: body.preferences,
    });

    if (!callResult.conversation_id) {
      return NextResponse.json(
        { error: 'ElevenLabs did not return a conversation ID' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      callId: callResult.conversation_id,
      status: 'initiated' as const,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to start the outbound call';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
