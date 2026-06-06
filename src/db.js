import { firestore } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';

const DB_KEY = 'mais_rico_juntos_db';

// To migrate old initialData to Firestore easily (or seed db)
const initialData = {
  utilizadores: [
    { id: 'u1', nome: 'Iury', cor_avatar: '#3b82f6' },
    { id: 'u2', nome: 'Esposa', cor_avatar: '#ec4899' }
  ],
  categorias: [
    { id: 1, nome: 'Moradia', icone: '🏠' },
    { id: 2, nome: 'Mercado', icone: '🛒' },
    { id: 3, nome: 'Restaurante/Delivery', icone: '🍔' },
    { id: 4, nome: 'Lazer & Cultura', icone: '🎉' },
    { id: 5, nome: 'Saúde & Farmácia', icone: '⚕️' },
    { id: 6, nome: 'Transporte & Carro', icone: '🚗' },
    { id: 7, nome: 'Malu e Lila', icone: '🐶' },
    { id: 8, nome: 'Educação', icone: '📚' },
    { id: 9, nome: 'Viagens', icone: '✈️' },
    { id: 10, nome: 'Vestuário', icone: '👕' },
    { id: 11, nome: 'Cuidados Pessoais', icone: '💇' },
    { id: 12, nome: 'Outros', icone: '📦' }
  ],
  receitas_fixas: [],
  despesas_fixas: [],
  lancamentos_mes: [],
  objetivos: []
};

// Caching to reduce reads if needed (simple implementation)
let localCache = {};

export const db = {
  async init() {
    // Check if we need to seed the db (check if 'utilizadores' has docs)
    try {
      const snap = await getDocs(collection(firestore, 'utilizadores'));
      if (snap.empty) {
        console.log('Seeding database...');
        for (const [colName, items] of Object.entries(initialData)) {
          for (const item of items) {
            const colRef = collection(firestore, colName);
            if (item.id) {
              await setDoc(doc(firestore, colName, String(item.id)), item);
            } else {
              await addDoc(colRef, item);
            }
          }
        }
      }
    } catch (e) {
      console.error("Error initializing DB:", e);
    }
    
    // Migration: Fix old installments that have description ending with (X/Y) but no valor_total
    try {
      const lancamentos = await getDocs(collection(firestore, 'lancamentos_mes'));
      for (const d of lancamentos.docs) {
        const data = d.data();
        if (data.tipo_lancamento === 'DESPESA_VARIAVEL' && data.valor_total === undefined && typeof data.descricao_custom === 'string') {
          const match = data.descricao_custom.match(/\((\d+)\/(\d+)\)$/);
          if (match) {
            const numParcelas = parseInt(match[2]);
            if (numParcelas > 1) {
              const valorAntigo = parseFloat(data.valor);
              const newVal = valorAntigo / numParcelas;
              await updateDoc(d.ref, {
                valor: newVal,
                valor_total: valorAntigo
              });
              console.log(`Migrated installment: ${data.descricao_custom}`);
            }
          }
        }
      }
    } catch (e) {
      console.error("Migration error:", e);
    }
    
    // Always force sync categories to ensure updates propagate to existing databases
    await this.syncCategorias();
  },
  
  async syncCategorias() {
    try {
      const snap = await getDocs(collection(firestore, 'categorias'));
      const existingIds = snap.docs.map(d => parseInt(d.id));
      
      for (const item of initialData.categorias) {
        await setDoc(doc(firestore, 'categorias', String(item.id)), item);
      }
    } catch (e) {
      console.error("Error syncing categories:", e);
    }
  },
  
  async getTable(tableName) {
    try {
      const snap = await getDocs(collection(firestore, tableName));
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      // Sort specific tables if needed, e.g. categorias
      if (tableName === 'categorias') {
        data.sort((a, b) => parseInt(a.id) - parseInt(b.id));
      }
      return data;
    } catch (e) {
      console.error(`Error getting ${tableName}:`, e);
      return [];
    }
  },
  
  async insert(tableName, record) {
    try {
      if (record.id) {
        await setDoc(doc(firestore, tableName, String(record.id)), record);
        return record;
      } else {
        const docRef = await addDoc(collection(firestore, tableName), record);
        return { ...record, id: docRef.id };
      }
    } catch (e) {
      console.error(`Error inserting to ${tableName}:`, e);
      throw e;
    }
  },

  async update(tableName, id, updates) {
    try {
      const docRef = doc(firestore, tableName, String(id));
      await updateDoc(docRef, updates);
      return { id, ...updates };
    } catch (e) {
      console.error(`Error updating ${tableName}:`, e);
      throw e;
    }
  },

  async delete(tableName, id) {
    try {
      await deleteDoc(doc(firestore, tableName, String(id)));
    } catch (e) {
      console.error(`Error deleting from ${tableName}:`, e);
      throw e;
    }
  }
};
