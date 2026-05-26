// db.js - Data Access Layer (Mocked with LocalStorage for Prototype)

const DB_KEY = 'mais_rico_juntos_db';

const initialData = {
  utilizadores: [
    { id: 'u1', nome: 'Iury', cor_avatar: '#3b82f6' },
    { id: 'u2', nome: 'Giulia', cor_avatar: '#ec4899' }
  ],
  categorias: [
    { id: 1, nome: 'Moradia', icone: '🏠' },
    { id: 2, nome: 'Mercado', icone: '🛒' },
    { id: 3, nome: 'Lazer', icone: '🎉' },
    { id: 4, nome: 'Saúde', icone: '⚕️' },
    { id: 5, nome: 'Transporte', icone: '🚗' },
    { id: 6, nome: 'Pets', icone: '🐾' },
    { id: 7, nome: 'Educação', icone: '📚' }
  ],
  receitas_fixas: [
    { id: 'r1', utilizador_id: 'u1', descricao: 'Salário Base', valor_estimado: 3500.00, dia_recebimento: 1 },
    { id: 'r2', utilizador_id: 'u2', descricao: 'Salário Base', valor_estimado: 3500.00, dia_recebimento: 1 }
  ],
  despesas_fixas: [
    { id: 'd1', categoria_id: 1, descricao: 'Renda', valor_estimado: 1200.00, dia_vencimento: 5, regra_divisao: '50_50', pago_por_padrao: 'u1' },
    { id: 'd2', categoria_id: 1, descricao: 'Conta da Luz', valor_estimado: 100.00, dia_vencimento: 10, regra_divisao: '50_50', pago_por_padrao: 'u2' },
    { id: 'd3', categoria_id: 6, descricao: 'Ração da Malu e Lila', valor_estimado: 80.00, dia_vencimento: 15, regra_divisao: '50_50', pago_por_padrao: 'u1' }
  ],
  lancamentos_mes: []
};

// Initialize DB
function initDB() {
  if (!localStorage.getItem(DB_KEY)) {
    localStorage.setItem(DB_KEY, JSON.stringify(initialData));
  }
}

// Helper to simulate async behavior
const delay = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

async function getDB() {
  await delay();
  return JSON.parse(localStorage.getItem(DB_KEY));
}

async function saveDB(data) {
  await delay();
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

export const db = {
  init: initDB,
  
  // Generic getters
  async getTable(tableName) {
    const data = await getDB();
    return data[tableName] || [];
  },
  
  async insert(tableName, record) {
    const data = await getDB();
    if (!record.id) {
      record.id = crypto.randomUUID();
    }
    data[tableName].push(record);
    await saveDB(data);
    return record;
  },

  async update(tableName, id, updates) {
    const data = await getDB();
    const index = data[tableName].findIndex(r => r.id === id);
    if (index > -1) {
      data[tableName][index] = { ...data[tableName][index], ...updates };
      await saveDB(data);
      return data[tableName][index];
    }
    throw new Error('Record not found');
  },

  async delete(tableName, id) {
    const data = await getDB();
    data[tableName] = data[tableName].filter(r => r.id !== id);
    await saveDB(data);
  }
};
