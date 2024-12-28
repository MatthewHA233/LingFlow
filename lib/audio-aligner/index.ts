import { createClient } from '@supabase/supabase-js';
import { alignWithGentle } from './gentle-client';
import { AudioAlignment } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function alignAudioWithText(
  audioFile: File,
  text: string,
  chapterId: string
): Promise<AudioAlignment[]> {
  try {
    // 1. Upload audio to Supabase
    const { data: audioData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(`chapters/${chapterId}/${audioFile.name}`, audioFile);

    if (uploadError) {
      throw new Error(`Audio upload failed: ${uploadError.message}`);
    }

    // 2. Get public URL for the uploaded audio
    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(`chapters/${chapterId}/${audioFile.name}`);

    // 3. Align with Gentle API
    const gentleResponse = await alignWithGentle(publicUrl, text);

    // 4. Transform response to our format
    return gentleResponse.words.map(word => ({
      startTime: word.start,
      endTime: word.end,
      text: word.word,
      confidence: word.aligned ? 1 : 0
    }));

  } catch (error) {
    console.error('Audio alignment error:', error);
    throw error instanceof Error ? error : new Error('Unknown error during audio alignment');
  }
}