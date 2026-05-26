// Simulate AI Scanner
// In a real scenario, this would call the Gemini API with the image

export async function scanReceipt() {
  console.log('Iniciando scan de recibo com IA (Simulação)...');
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulated Gemini JSON response
  const response = {
    "valor_total": 45.90,
    "estabelecimento": "Supermercado Continente",
    "categoria_sugerida": "Mercado"
  };
  
  return response;
}
