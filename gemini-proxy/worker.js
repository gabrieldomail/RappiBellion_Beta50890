// Rappibellion — AI Proxy Worker (OpenRouter)
// La API key se guarda en Variables de Entorno (Secrets), nunca en el código

const ALLOWED_ORIGINS = [
  'https://rappibellion.com',
  'https://www.rappibellion.com',
  'https://gabrieldomail.github.io',
];

const OPENROUTER_MODEL = 'google/gemini-2.0-flash-exp:free';
const OPENROUTER_URL   = 'https://openrouter.ai/api/v1/chat/completions';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const apiKey = env.GEMINI_API_KEY; // mismo nombre de secret, solo cambia el destino
    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: 'Worker: API key no configurada' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    try {
      // Recibe formato Gemini del frontend — convierte a OpenAI para OpenRouter
      const body = await request.json();

      const messages = [];

      // System instruction
      const sysText = body?.systemInstruction?.parts?.[0]?.text;
      if (sysText) messages.push({ role: 'system', content: sysText });

      // Historial de conversación
      for (const turn of (body.contents || [])) {
        const text = turn?.parts?.[0]?.text || '';
        const role = turn.role === 'model' ? 'assistant' : 'user';
        messages.push({ role, content: text });
      }

      const orRes = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://rappibellion.com',
          'X-Title': 'Rappibellion',
        },
        body: JSON.stringify({ model: OPENROUTER_MODEL, messages }),
      });

      const data = await orRes.json();

      if (!orRes.ok) {
        return new Response(JSON.stringify({ error: { message: data?.error?.message || 'OpenRouter error' } }),
          { status: orRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Convierte respuesta OpenAI → formato Gemini para el frontend
      const replyText = data?.choices?.[0]?.message?.content || '';
      const geminiResponse = {
        candidates: [{ content: { parts: [{ text: replyText }] } }]
      };

      return new Response(JSON.stringify(geminiResponse), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: { message: 'Worker error: ' + err.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
};
