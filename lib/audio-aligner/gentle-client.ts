import { GentleResponse } from './types';

const GENTLE_API_URL = process.env.NEXT_PUBLIC_GENTLE_API_URL;

export async function alignWithGentle(audioUrl: string, text: string): Promise<GentleResponse> {
  try {
    const response = await fetch(`${GENTLE_API_URL}/transcriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: audioUrl, transcript: text }),
    });

    if (!response.ok) {
      throw new Error(`Gentle API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Audio alignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}