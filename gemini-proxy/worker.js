// Rappibellion — Gemini Proxy Worker
// Deployar en Cloudflare Workers
// La API key se guarda en Variables de Entorno (Secrets), nunca en el código

const ALLOWED_ORIGINS = [
  'https://rappibellion.com',
  'https://www.rappibellion.com',
  'https://gabrieldomail.github.io',
];

const GEMINI_MODEL = 'gemini-2.0-flash';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS — solo dominios autorizados
    const allowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // La key vive en env.GEMINI_API_KEY — nunca en el código
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: 'Worker: API key no configurada' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    try {
      const body = await request.json();
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await geminiRes.json();
      return new Response(JSON.stringify(data), {
        status: geminiRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: { message: 'Worker error: ' + err.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
};
