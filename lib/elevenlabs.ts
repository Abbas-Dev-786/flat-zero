type OutboundCallParams = {
  toPhoneNumber: string;
  propertyAddress: string;
  askingRent: string;
  listingDetails: string;
  leveragePoints: string[];
  userQuestions: string[];
};

type ConversationTranscriptEntry = {
  role?: string | null;
  message?: string | null;
  time_in_call_secs?: number | null;
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

function clipText(value: string, limit = 5000) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trimEnd()}\n\n[Listing details truncated for length]`;
}

export function buildAgentPrompt({
  propertyAddress,
  askingRent,
  listingDetails,
  leveragePoints,
  userQuestions,
}: OutboundCallParams) {
  const formattedQuestions =
    userQuestions.length > 0
      ? userQuestions.map((question) => `- ${question}`).join('\n')
      : '- Confirm the property is still available and clarify next steps.';

  const formattedLeverage =
    leveragePoints.length > 0
      ? leveragePoints.map((point) => `- ${point}`).join('\n')
      : '- The tenant is serious, ready to move quickly, and open to a mutually beneficial agreement.';

  return [
    'You are a professional property rental assistant who makes outbound calls on behalf of prospective tenants to enquire about rental listings.',
    '',
    `Property: ${propertyAddress}`,
    `Current asking rent: ${askingRent}`,
    '',
    'Instructions for this specific call:',
    '1. Introduce yourself as calling on behalf of a prospective tenant.',
    '2. Confirm the property is still available.',
    '3. Work through each of the tenant questions naturally instead of reading a script.',
    '4. Use the leverage points naturally to negotiate rent if the conversation allows it.',
    '5. Try to schedule a viewing if the conversation is positive.',
    '6. Summarize what was agreed before ending the call.',
    '',
    'Tone requirements:',
    '- Be professional, friendly, and confident.',
    '- Never sound robotic or aggressive.',
    '- Do not invent facts that are not in the listing details below.',
    '- If you are asked something you cannot answer, say exactly: "I\'ll need to check with my client and get back to you."',
    '',
    'Tenant questions:',
    formattedQuestions,
    '',
    'Negotiation leverage:',
    formattedLeverage,
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
          conversation_config_override: {
            agent: {
              prompt: {
                prompt: buildAgentPrompt(params),
              },
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
        ? ' Make sure prompt overrides are enabled for the agent in ElevenLabs.'
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
