import type { Entorno } from '../entorno';

const ORIGEN = 'https://openrouter.ai/api/v1';

function cabeceras(entorno: Entorno): HeadersInit {
  return {
    Authorization: `Bearer ${entorno.openRouterKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': entorno.origen,
    'X-OpenRouter-Title': 'Apoyo tutorial IT Tlalnepantla',
  };
}

export async function embeberTextos(textos: string[], entorno: Entorno): Promise<number[][]> {
  if (!entorno.openRouterKey) {
    throw new Error('Falta OPENROUTER_API_KEY.');
  }
  const respuesta = await fetch(`${ORIGEN}/embeddings`, {
    method: 'POST',
    headers: cabeceras(entorno),
    body: JSON.stringify({ model: entorno.embeddingModel, input: textos }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`OpenRouter no generó embeddings (${respuesta.status}): ${detalle.slice(0, 280)}`);
  }
  const cuerpo = (await respuesta.json()) as {
    data?: Array<{ embedding: number[]; index: number }>;
  };
  const data = [...(cuerpo.data ?? [])].sort((a, b) => a.index - b.index);
  if (data.length !== textos.length) {
    throw new Error('OpenRouter devolvió una cantidad distinta de embeddings.');
  }
  return data.map((item) => item.embedding);
}

export async function completarJson(system: string, user: string, entorno: Entorno): Promise<string> {
  if (!entorno.openRouterKey) {
    throw new Error('Falta OPENROUTER_API_KEY.');
  }
  const respuesta = await fetch(`${ORIGEN}/chat/completions`, {
    method: 'POST',
    headers: cabeceras(entorno),
    body: JSON.stringify({
      model: entorno.chatModel,
      temperature: 0.1,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`OpenRouter no respondió la consulta (${respuesta.status}): ${detalle.slice(0, 280)}`);
  }
  const cuerpo = (await respuesta.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const contenido = cuerpo.choices?.[0]?.message?.content;
  if (!contenido) throw new Error('OpenRouter devolvió una respuesta vacía.');
  return contenido;
}
