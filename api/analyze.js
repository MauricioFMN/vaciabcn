export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { images, context } = req.body;

    if (!images || !images.length) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const prompt = `Eres experto en vaciado de pisos en Barcelona, España. Analiza las fotos y genera presupuesto orientativo.
CONTEXTO: tipo=${context.tipo}, metros=${context.m2}, motivo=${context.motivo}, urgencia=${context.urgencia}, extra="${context.extra || 'ninguno'}"
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin backticks, sin markdown:
{"precio_min":número,"precio_max":número,"confianza":número60a95,"items":[{"n":"nombre","i":"alto|medio|bajo"}],"factores":"2-3 frases","analisis":"4-5 frases detalladas","advertencias":["solo si hay algo especial"],"wa":"frase resumen breve"}
Precios referencia Barcelona 2025: estudio<40m²:200-350€, piso40-70m²:350-550€, piso70-100m²:500-750€, piso100-150m²:700-1100€, +150m²:1000-1800€, local:400-1500€, nave:800-3000€.`;

    const content = [
      { type: 'text', text: prompt },
      ...images.map(({ base64, mediaType }) => ({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 }
      }))
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `API error: ${err.slice(0, 200)}` });
    }

    const data = await response.json();
    const raw = (data.content || []).map(b => b.text || '').join('');
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      return res.status(500).json({ error: 'No se pudo procesar la respuesta.' });
    }

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error inesperado' });
  }
}
