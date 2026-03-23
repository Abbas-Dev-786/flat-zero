import { NextResponse } from 'next/server';
import { createOutboundCall } from '@/lib/elevenlabs';

type CallRequest = {
  toPhoneNumber?: string;
  propertyAddress?: string;
  askingRent?: string;
  listingDetails?: string;
  leveragePoints?: string[];
  userQuestions?: string[];
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
      !Array.isArray(body.userQuestions)
    ) {
      return NextResponse.json(
        { error: 'Missing required call parameters' },
        { status: 400 },
      );
    }

    const callResult = await createOutboundCall({
      toPhoneNumber: body.toPhoneNumber,
      propertyAddress: body.propertyAddress,
      askingRent: body.askingRent,
      listingDetails: body.listingDetails,
      leveragePoints: body.leveragePoints,
      userQuestions: body.userQuestions,
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
