import type { SearchPreference } from '@/lib/types';

type OutboundCallParams = {
  toPhoneNumber: string;
  propertyAddress: string;
  listingPrice: number;
  comparables: number[];
  listingDetails: string;
  leveragePoints: string[];
  userQuestions: string[];
  preferences: SearchPreference[];
};

type ConversationTranscriptEntry = {
  role?: string | null;
  message?: string | null;
  time_in_call_secs?: number | null;
};

type DynamicVariables = {
  listing_price: number;
  avg_price: number;
  target_price: number;
  anchor_price: number;
  max_price: number;
  comparables: string;
  property_address: string;
  preferences: string;
  pressure_phrases: string;
};

export type ElevenLabsConversation = {
  agent_id?: string;
  agent_name?: string | null;
  conversation_id?: string;
  status?: 'initiated' | 'in-progress' | 'processing' | 'done' | 'failed';
  transcript?: ConversationTranscriptEntry[];
  metadata?: {
    call_duration_secs?: number | null;
  } | null;
  analysis?: Record<string, unknown> | null;
  conversation_initiation_client_data?: Record<string, unknown> | null;
};

const PRESSURE_PHRASES = [
  'I’m ready to move quickly',
  'I’ve seen better options nearby',
  'I can finalize today if we agree',
];

function clipText(value: string, limit = 5000) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trimEnd()}\n\n[Listing details truncated for length]`;
}

function formatPreference(preference: SearchPreference) {
  if (typeof preference.value === 'boolean') {
    return preference.value
      ? preference.label
      : `${preference.label}: no`;
  }

  if (Array.isArray(preference.value)) {
    return `${preference.label}: ${preference.value.join(', ')}`;
  }

  if (preference.value === null) {
    return preference.label;
  }

  return `${preference.label}: ${preference.value}`;
}

export function computeNegotiationStrategy(
  listingPrice: number,
  comparables: number[],
) {
  const usableComparables = comparables.filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  const baselinePrices =
    usableComparables.length > 0
      ? usableComparables
      : Number.isFinite(listingPrice) && listingPrice > 0
        ? [listingPrice]
        : [];

  if (baselinePrices.length === 0) {
    throw new Error(
      'Unable to compute negotiation strategy without a valid listing price or comparable rents.',
    );
  }

  const avg =
    baselinePrices.reduce((total, value) => total + value, 0) /
    baselinePrices.length;

  const target = Math.round(avg * 0.98);
  const anchor = Math.round(avg * 0.92);
  const maxAcceptable = Math.round(avg * 1.02);

  return {
    avg: Math.round(avg),
    target,
    anchor,
    maxAcceptable,
  };
}

function buildDynamicVariables(params: OutboundCallParams): DynamicVariables {
  const strategy = computeNegotiationStrategy(
    params.listingPrice,
    params.comparables,
  );

  return {
    listing_price: params.listingPrice,
    avg_price: strategy.avg,
    target_price: strategy.target,
    anchor_price: strategy.anchor,
    max_price: strategy.maxAcceptable,
    comparables:
      params.comparables.length > 0
        ? params.comparables.join(', ')
        : String(params.listingPrice),
    property_address: params.propertyAddress,
    preferences:
      params.preferences.length > 0
        ? params.preferences.map(formatPreference).join('; ')
        : 'No additional preferences provided.',
    pressure_phrases: PRESSURE_PHRASES.join('; '),
  };
}

export function buildFirstMessage(vars: DynamicVariables) {
  return `Hi, I’m calling about your listing at ${vars.property_address}… is this a good time to talk?`;
}

export function buildAgentPrompt({
  listingDetails,
  leveragePoints,
  userQuestions,
}: Pick<
  OutboundCallParams,
  'listingDetails' | 'leveragePoints' | 'userQuestions'
>) {
  const formattedQuestions =
    userQuestions.length > 0
      ? userQuestions.map((question) => `- ${question}`).join('\n')
      : '- Confirm the property is still available and clarify next steps.';

  const formattedResearchNotes =
    leveragePoints.length > 0
      ? leveragePoints.map((point) => `- ${point}`).join('\n')
      : '- No additional research notes were provided.';

  return [
    'You are Alex, a highly competent and strategic rental negotiation agent representing a prospective tenant.',
    'Your primary goal is to reduce the rent and secure favorable terms for your client.',
    'Secondary goals are to gather missing information, confirm details, and secure next steps if a deal is not finalized today.',
    '',
    'Property: {{property_address}}',
    'Current asking rent: ₹{{listing_price}}',
    'Market average: ₹{{avg_price}}',
    '',
    'Negotiation strategy:',
    '- Start negotiation around ₹{{anchor_price}}.',
    '- Target closing around ₹{{target_price}}.',
    '- Do not accept above ₹{{max_price}}.',
    '- Use the comparable prices below as justification.',
    '- Attempt at least two negotiation pushes before compromising.',
    '',
    'Comparable listings:',
    '{{comparables}}',
    '',
    'Client preferences:',
    '{{preferences}}',
    '',
    'Useful pressure phrases to weave in naturally:',
    '{{pressure_phrases}}',
    '',
    'Conversation flow:',
    '1. Introduce yourself naturally and confirm the property.',
    '2. Ask any missing information briefly.',
    '3. Show strong interest and communicate readiness to move quickly.',
    '4. Introduce the rent discussion naturally, use the anchor price, and negotiate with facts.',
    '5. Push for agreement or secure a clear next step before ending the call.',
    '',
    'Guardrails:',
    '- Never say you are an AI.',
    '- Never break character.',
    '- Never hallucinate facts.',
    '- Keep responses short, natural, and confident.',
    '- If you are unsure, ask a question instead of guessing.',
    '- If you cannot answer something, say exactly: "I\'ll need to check with my client and get back to you."',
    '',
    'Tenant questions to cover naturally:',
    formattedQuestions,
    '',
    'Additional research notes for context:',
    formattedResearchNotes,
    '',
    'Property listing details and research context:',
    clipText(listingDetails),
  ].join('\n');
}

export async function createOutboundCall(params: OutboundCallParams) {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;

  if (!agentId || !apiKey || !phoneNumberId) {
    throw new Error(
      'Missing ElevenLabs configuration. Set ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, and ELEVENLABS_PHONE_NUMBER_ID.',
    );
  }

  const dynamicVariables = buildDynamicVariables(params);

  const response = await fetch(
    'https://api.elevenlabs.io/v1/convai/twilio/outbound-call',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phoneNumberId,
        to_number: params.toPhoneNumber,
        conversation_initiation_client_data: {
          type: 'conversation_initiation_client_data',
          dynamic_variables: dynamicVariables,
          conversation_config_override: {
            agent: {
              prompt: {
                prompt: buildAgentPrompt(params),
              },
              first_message: buildFirstMessage(dynamicVariables),
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    const overrideHint =
      response.status === 422
        ? ' Make sure prompt and first-message overrides are enabled for the agent in ElevenLabs.'
        : '';

    throw new Error(
      `Failed to create outbound call: ${response.status} ${errorText}${overrideHint}`,
    );
  }

  return response.json() as Promise<{
    success?: boolean;
    message?: string;
    conversation_id?: string | null;
    callSid?: string | null;
  }>;
}

export async function getConversationStatus(conversationId: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set');
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
    {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch conversation status: ${response.status}`);
  }

  return response.json() as Promise<ElevenLabsConversation>;
}
