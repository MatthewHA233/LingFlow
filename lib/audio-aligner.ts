const ASSEMBLY_AI_API_KEY = process.env.NEXT_PUBLIC_ASSEMBLY_AI_API_KEY;
const API_URL = 'https://api.assemblyai.com/v2';

export async function alignAudio(audioFile: File, text: string) {
  // First, upload the audio file
  const uploadUrl = await uploadAudio(audioFile);
  
  // Then create an alignment task
  const response = await fetch(`${API_URL}/align`, {
    method: 'POST',
    headers: {
      'Authorization': ASSEMBLY_AI_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: uploadUrl,
      text: text,
    }),
  });

  const result = await response.json();
  return result;
}

async function uploadAudio(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('audio', file);

  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': ASSEMBLY_AI_API_KEY!,
    },
    body: formData,
  });

  const { upload_url } = await response.json();
  return upload_url;
}