export const config = {
  runtime: 'edge',
};

// Domínios autorizados (adicione o seu domínio Vercel real aqui)
const ALLOWED_ORIGINS = [
  'https://mais-rico-juntos.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function getCorsHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.some(o => origin?.startsWith(o));
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default async function handler(request) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid imageBase64' }), { status: 400, headers: corsHeaders });
    }

    // Limitar tamanho do payload (~10MB em base64)
    if (imageBase64.length > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Image too large' }), { status: 413, headers: corsHeaders });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY in environment variables' }), { status: 500, headers: corsHeaders });
    }

    const payload = {
      contents: [
        {
          parts: [
            { text: "Analise a imagem desta fatura/recibo e extraia as informações comerciais necessárias. Retorne estritamente um objeto JSON com as chaves abaixo, sem formatação markdown adicional: {\"valor_total\": (float), \"estabelecimento\": (string), \"categoria_sugerida\": (string, classifique estritamente numa destas opções: 'Moradia', 'Mercado', 'Lazer', 'Saúde', 'Transporte', 'Malu e Lila', 'Educação')}" },
            { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
          ]
        }
      ]
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    let textResponse = data.candidates[0].content.parts[0].text;
    
    // Clean up potential markdown blocks
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return new Response(textResponse, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Erro na API de Scan:", error);
    return new Response(JSON.stringify({ error: 'Erro ao processar imagem', details: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
}
