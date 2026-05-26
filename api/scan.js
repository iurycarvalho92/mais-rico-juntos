export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'Missing imageBase64' }), { status: 400 });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY in environment variables' }), { status: 500 });
    }

    const payload = {
      contents: [
        {
          parts: [
            { text: "Analise a imagem desta fatura/recibo e extraia as informações comerciais necessárias. Retorne estritamente um objeto JSON com as chaves abaixo, sem formatação markdown adicional: {\"valor_total\": (float), \"estabelecimento\": (string), \"categoria_sugerida\": (string, classifique estritamente numa destas opções: 'Moradia', 'Mercado', 'Lazer', 'Saúde', 'Transporte', 'Pets', 'Educação')}" },
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
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Erro na API de Scan:", error);
    return new Response(JSON.stringify({ error: 'Erro ao processar imagem', details: error.message }), { status: 500 });
  }
}
