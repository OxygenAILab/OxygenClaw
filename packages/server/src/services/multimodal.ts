export interface AnalyzeImageOptions {
  detail?: 'low' | 'high' | 'auto';
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface AnalyzeResult {
  content: string;
  usage: any;
}

export interface TranscribeResult {
  text: string;
}

export interface SynthesizeResult {
  audioBase64: string;
  format: string;
}

export async function analyzeImage(
  apiKey: string,
  baseUrl: string,
  model: string,
  imageBase64: string,
  prompt: string,
  options?: AnalyzeImageOptions
): Promise<AnalyzeResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const messageContent: any[] = [
    {
      type: 'text',
      text: prompt,
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${imageBase64}`,
        detail: options?.detail || 'auto',
      },
    },
  ];

  const body: any = {
    model,
    messages: [
      {
        role: 'user',
        content: messageContent,
      },
    ],
  };

  if (options?.reasoningEffort) {
    body.reasoning_effort = options.reasoningEffort;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image analysis failed: HTTP ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response format from vision API');
  }

  return {
    content: data.choices[0].message.content || '',
    usage: data.usage || {},
  };
}

export async function analyzeVideo(
  apiKey: string,
  baseUrl: string,
  model: string,
  videoData: { type: 'base64' | 'url'; data: string },
  prompt: string
): Promise<AnalyzeResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  let videoUrl: string;
  if (videoData.type === 'base64') {
    videoUrl = `data:video/mp4;base64,${videoData.data}`;
  } else {
    videoUrl = videoData.data;
  }

  const messageContent: any[] = [
    {
      type: 'text',
      text: prompt,
    },
    {
      type: 'image_url',
      image_url: {
        url: videoUrl,
      },
    },
  ];

  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: messageContent,
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Video analysis failed: HTTP ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response format from vision API');
  }

  return {
    content: data.choices[0].message.content || '',
    usage: data.usage || {},
  };
}

export async function transcribeAudio(
  apiKey: string,
  baseUrl: string,
  model: string,
  audioBase64: string,
  format: string = 'mp3'
): Promise<TranscribeResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/audio/transcriptions`;

  const audioBuffer = Buffer.from(audioBase64, 'base64');

  const boundary = '----OxygenClawBoundary' + Date.now();
  let bodyBuffer = Buffer.alloc(0);

  const addField = (name: string, value: string) => {
    const field = `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
    bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(field)]);
  };

  const addFile = (name: string, filename: string, data: Buffer, mimeType: string) => {
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(header), data, Buffer.from('\r\n')]);
  };

  addField('model', model);
  addFile('file', `audio.${format}`, audioBuffer, `audio/${format}`);

  bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(`--${boundary}--\r\n`)]);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: bodyBuffer as any,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Audio transcription failed: HTTP ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;

  return {
    text: data.text || '',
  };
}

export async function synthesizeSpeech(
  apiKey: string,
  baseUrl: string,
  model: string,
  text: string,
  voice?: string
): Promise<SynthesizeResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/audio/speech`;

  const body: any = {
    model,
    input: text,
  };

  if (voice) {
    body.voice = voice;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Speech synthesis failed: HTTP ${response.status} - ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || 'audio/mpeg';
  const arrayBuffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

  let format = 'mp3';
  if (contentType.includes('wav')) {
    format = 'wav';
  } else if (contentType.includes('ogg') || contentType.includes('opus')) {
    format = 'opus';
  } else if (contentType.includes('flac')) {
    format = 'flac';
  }

  return {
    audioBase64,
    format,
  };
}
