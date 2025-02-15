const ASSEMBLY_AI_API_KEY = process.env.NEXT_PUBLIC_ASSEMBLY_AI_API_KEY;
const API_URL = 'https://api.assemblyai.com/v2';

export async function alignAudio(audioFile: File, text: string) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('text', text);

  const response = await fetch('/api/align', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`对齐失败: ${await response.text()}`);
  }

  return response.json();
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