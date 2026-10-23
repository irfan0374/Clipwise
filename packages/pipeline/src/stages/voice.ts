import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "../env";
import { providerGuards } from "../guards";
import { FatalError, withRetry } from "../retry";
import type { Alignment, Script } from "../types";
import { creditsFor } from "../usage";

/** The narration sent to ElevenLabs: every scene's narration joined by single spaces. */
export const narrationText = (script: Script) => script.scenes.map((s) => s.narration.trim()).join(" ");

export type VoiceResult = { audio: Buffer; alignment: Alignment; characters: number; model: string; attempts: number };

export const generateVoice = async (
  text: string,
  { final = false, speed = 1, voiceId: chosenVoice }: { final?: boolean; speed?: number; voiceId?: string } = {},
): Promise<VoiceResult> => {
  const { apiKey, voiceId: defaultVoice, modelDraft, modelFinal } = env.elevenLabs();
  const voiceId = chosenVoice ?? defaultVoice;
  const client = new ElevenLabsClient({ apiKey });
  const model = final ? modelFinal : modelDraft;

  const guards = providerGuards();
  const credits = creditsFor(text.length, model);
  const { value: response, attempts } = await withRetry(
    async () => {
      await guards.reserveVoiceCredits?.(credits); // budget reservation, per request
      try {
        return await client.textToSpeech.convertWithTimestamps(voiceId, {
          text,
          modelId: model,
          outputFormat: "mp3_44100_128",
          voiceSettings: { speed },
        });
      } catch (error) {
        await guards.releaseVoiceCredits?.(credits); // failed requests aren't charged
        const status = (error as { statusCode?: number }).statusCode;
        const body = JSON.stringify((error as { body?: unknown }).body ?? "");
        if (/paid_plan_required/.test(body)) {
          throw new FatalError(
            "This ElevenLabs voice needs a paid plan. On the free plan use a default voice, e.g. George JBFqnCBsd6RMkjVDRZzb, Brian nPczCjzI2devNBz1zQrb, Liam TX3LPaxmHKxFdv7VOQHJ or Jessica cgSgspJ2msm6clMCkdW9, as ELEVENLABS_VOICE_ID in .env.",
          );
        }
        if (/voice_not_found/.test(body))
          throw new FatalError(`ELEVENLABS_VOICE_ID "${voiceId}" was not found on this account.`);
        if (status === 401 || /quota|credits/i.test(body)) {
          throw new FatalError(`ElevenLabs refused the request (${status}): out of credits or invalid key. ${body}`);
        }
        throw error;
      }
    },
    { label: "ElevenLabs" },
  );

  await guards.onVoiceTake?.({ credits, characters: text.length, model }); // charged: record now
  if (!response.alignment) throw new Error("ElevenLabs returned no alignment");
  return {
    audio: Buffer.from(response.audioBase64, "base64"),
    alignment: response.alignment,
    characters: text.length,
    model,
    attempts,
  };
};
