import { NextResponse } from 'next/server';
import { getConversationStatus, type ElevenLabsConversation } from '@/lib/elevenlabs';

type RouteProps = {
  params: Promise<{ callId: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStatus(status: ElevenLabsConversation['status']) {
  switch (status) {
    case 'done':
      return 'completed' as const;
    case 'failed':
      return 'failed' as const;
    case 'initiated':
    case 'in-progress':
    case 'processing':
    default:
      return 'in-progress' as const;
  }
}

function formatTranscript(transcript: ElevenLabsConversation['transcript']) {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return null;
  }

  return transcript
    .map((entry) => {
      const role = entry.role === 'agent' ? 'Agent' : 'Landlord';
      const timestamp =
        typeof entry.time_in_call_secs === 'number'
          ? ` (${Math.floor(entry.time_in_call_secs)}s)`
          : '';
      const message = entry.message?.trim();

      return message ? `${role}${timestamp}: ${message}` : null;
    })
    .filter((entry): entry is string => entry !== null)
    .join('\n\n');
}

function extractSummary(analysis: ElevenLabsConversation['analysis']) {
  if (!isRecord(analysis)) {
    return null;
  }

  const candidates = [
    analysis.transcript_summary,
    analysis.summary,
    analysis.call_summary,
    analysis.call_summary_title,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function extractQuestionsAnswered(analysis: ElevenLabsConversation['analysis']) {
  if (!isRecord(analysis)) {
    return {};
  }

  const rawCollection = analysis.data_collection_results ?? analysis.data_collection_result;
  if (!isRecord(rawCollection)) {
    return {};
  }

  return Object.entries(rawCollection).reduce<Record<string, string>>(
    (accumulator, [key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        accumulator[key] = value.trim();
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        accumulator[key] = String(value);
      }

      return accumulator;
    },
    {},
  );
}

function extractViewingScheduled(questionsAnswered: Record<string, string>) {
  for (const [key, value] of Object.entries(questionsAnswered)) {
    if (/(viewing|tour|appointment|schedule)/i.test(key) && value.trim()) {
      return value;
    }
  }

  return null;
}

export async function GET(_request: Request, props: RouteProps) {
  try {
    const { callId } = await props.params;

    if (!callId) {
      return NextResponse.json({ error: 'callId is required' }, { status: 400 });
    }

    const conversation = await getConversationStatus(callId);
    const questionsAnswered = extractQuestionsAnswered(conversation.analysis);

    return NextResponse.json({
      status: normalizeStatus(conversation.status),
      transcript: formatTranscript(conversation.transcript),
      summary: extractSummary(conversation.analysis),
      questionsAnswered,
      viewingScheduled: extractViewingScheduled(questionsAnswered),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to retrieve call status';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
