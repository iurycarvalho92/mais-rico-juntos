export async function scanReceipt(imageBase64) {
  console.log('Iniciando scan de recibo com IA via Vercel Edge Function...');
  
  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 })
    });
    
    if (!response.ok) {
      console.warn("Vercel API falhou. Retornando dados simulados para fallback local.");
      return mockScan();
    }
    
    return await response.json();
  } catch (e) {
    console.warn("Erro ao chamar /api/scan, usando simulador local.", e);
    return mockScan();
  }
}

async function mockScan() {
  await new Promise(resolve => setTimeout(resolve, 1500));
  return {
    "valor_total": 45.90,
    "estabelecimento": "Supermercado Continente (Simulado)",
    "categoria_sugerida": "Mercado"
  };
}
