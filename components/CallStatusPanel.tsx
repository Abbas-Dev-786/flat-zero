'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

type CallStatusPanelProps = {
  onRetry?: () => void;
};

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function CallStatusPanel({ onRetry }: CallStatusPanelProps) {
  const currentSession = useAppStore((state) => state.currentSession);
  const updateCallState = useAppStore((state) => state.updateCallState);

  const callState = currentSession?.callState;
  const [elapsedTimer, setElapsedTimer] = useState<{ callId: string | null; seconds: number }>(
    { callId: null, seconds: 0 },
  );
  const [showTranscript, setShowTranscript] = useState(false);

  const pollCallStatus = useEffectEvent(async (callId: string) => {
    const response = await fetch(`/api/call-status/${callId}`);
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    updateCallState({
      status: payload.status,
      transcript: payload.transcript,
      summary: payload.summary,
      questionsAnswered: payload.questionsAnswered ?? {},
      viewingScheduled: payload.viewingScheduled ?? null,
    });
  });

  useEffect(() => {
    if (
      !callState?.callId ||
      (callState.status !== 'initiating' && callState.status !== 'in-progress')
    ) {
      return;
    }

    void pollCallStatus(callState.callId);

    const interval = window.setInterval(() => {
      void pollCallStatus(callState.callId!);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [callState?.callId, callState?.status]);

  useEffect(() => {
    if (!callState?.callId) {
      return;
    }

    const currentCallId = callState.callId;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsedTimer({
        callId: currentCallId,
        seconds: Math.floor((Date.now() - startedAt) / 1000),
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [callState?.callId]);

  const questionEntries = Object.entries(callState?.questionsAnswered ?? {});

  if (!callState || callState.status === 'idle') {
    return null;
  }

  const isComplete = callState.status === 'completed';
  const isFailed = callState.status === 'failed';
  const isInProgress =
    callState.status === 'initiating' || callState.status === 'in-progress';
  const elapsedSeconds =
    callState.callId && elapsedTimer.callId === callState.callId
      ? elapsedTimer.seconds
      : 0;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/75 shadow-2xl backdrop-blur-xl">
      <div
        className={`border-b px-5 py-4 ${
          isComplete
            ? 'border-emerald-500/20 bg-emerald-500/10'
            : isFailed
              ? 'border-red-500/20 bg-red-500/10'
              : 'border-indigo-500/20 bg-indigo-500/10'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isInProgress && (
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-70" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-500" />
              </span>
            )}
            {isComplete && <span className="h-3 w-3 rounded-full bg-emerald-400" />}
            {isFailed && <span className="h-3 w-3 rounded-full bg-red-400" />}

            <div>
              <p className="text-sm font-semibold text-white">
                {callState.status === 'initiating'
                  ? 'Initiating outbound call'
                  : callState.status === 'in-progress'
                    ? 'Call in progress'
                    : callState.status === 'completed'
                      ? 'Call completed'
                      : 'Call failed'}
              </p>
              <p className="text-xs text-gray-300">
                {isInProgress
                  ? `Elapsed time ${formatElapsed(elapsedSeconds)}`
                  : isComplete
                    ? 'The landlord call has finished and the summary is ready.'
                    : 'The call did not complete successfully.'}
              </p>
            </div>
          </div>

          {isFailed && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20"
            >
              Retry call
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {(callState.summary || isComplete) && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
              Call summary
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-200">
              {callState.summary || 'The call ended, but ElevenLabs has not returned a summary yet.'}
            </p>
          </div>
        )}

        {callState.viewingScheduled && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Viewing scheduled: {callState.viewingScheduled}
          </div>
        )}

        {questionEntries.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
              Questions answered
            </p>
            <div className="mt-4 space-y-3">
              {questionEntries.map(([question, answer]) => (
                <div key={question} className="rounded-xl bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-gray-500">
                    {question}
                  </p>
                  <p className="mt-2 text-sm text-gray-200">{answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
              Transcript
            </p>
            <button
              type="button"
              onClick={() => setShowTranscript((current) => !current)}
              className="text-xs font-medium text-blue-300 transition-colors hover:text-white"
            >
              {showTranscript ? 'Hide transcript' : 'Show transcript'}
            </button>
          </div>

          {showTranscript ? (
            <div className="mt-4 max-h-72 overflow-y-auto rounded-xl bg-black/20 p-4 text-sm leading-6 text-gray-200">
              {callState.transcript ? (
                <pre className="whitespace-pre-wrap font-sans">{callState.transcript}</pre>
              ) : (
                <p className="text-gray-500">
                  {isInProgress
                    ? 'Transcript has not started streaming yet.'
                    : 'No transcript was available for this call.'}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              Expand this section to inspect the full conversation transcript.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
