import { db } from './db.js';
import { getCurrentMonthStr } from './utils.js';

export async function runRecurrenceEngine() {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentYear = currentDate.getFullYear();
  
  const runKey = `engine_run_${currentYear}_${currentMonth}`;
  
  // ✅ FIX: Usar Firestore em vez de localStorage para controle multi-device
  // Assim ambos os dispositivos consultam a mesma flag e nunca duplicam
  try {
    const metadata = await db.getTable('metadata');
    if (metadata.find(m => m.id === runKey)) {
      console.log('Engine já rodou neste mês (Firestore).');
      return;
    }
  } catch (e) {
    console.warn('Could not check engine metadata, skipping:', e);
    return;
  }
  
  console.log('Running Monthly Recurrence Engine...');
  
  const receitas = await db.getTable('receitas_fixas');
  const despesas = await db.getTable('despesas_fixas');
  
  const currentMonthStr = getCurrentMonthStr();
  
  // 1. Process Receitas Fixas
  for (const r of receitas) {
    if (r.ultimo_mes_gerado === currentMonthStr) continue;
    
    const dataVencimento = `${currentMonthStr}-${String(r.dia_recebimento).padStart(2, '0')}`;
    
    await db.insert('lancamentos_mes', {
      valor: r.valor_estimado,
      data_vencimento: dataVencimento,
      categoria_id: null,
      descricao_custom: r.descricao,
      tipo_lancamento: 'RECEITA',
      pago_por: r.utilizador_id,
      regra_divisao: 'INDIVIDUAL',
      status: 'PENDENTE'
    });
    
    await db.update('receitas_fixas', r.id, { ultimo_mes_gerado: currentMonthStr });
  }
  
  // 2. Process Despesas Fixas
  for (const d of despesas) {
    if (d.ultimo_mes_gerado === currentMonthStr) continue;
    
    const dataVencimento = `${currentMonthStr}-${String(d.dia_vencimento).padStart(2, '0')}`;
    
    await db.insert('lancamentos_mes', {
      valor: d.valor_estimado,
      data_vencimento: dataVencimento,
      categoria_id: d.categoria_id,
      descricao_custom: d.descricao,
      tipo_lancamento: 'DESPESA_FIXA',
      pago_por: d.pago_por_padrao,
      regra_divisao: d.regra_divisao || null,
      regra_divisao_percent: d.regra_divisao_percent !== undefined ? d.regra_divisao_percent : 50,
      status: 'PENDENTE'
    });
    
    await db.update('despesas_fixas', d.id, { ultimo_mes_gerado: currentMonthStr });
  }
  
  // ✅ FIX: Marcar como executado no Firestore (não no localStorage)
  await db.insert('metadata', { id: runKey, executado: true, data: currentMonthStr });
  console.log('Recurrence Engine finished.');
}
