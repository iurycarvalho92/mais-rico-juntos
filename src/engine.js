import { db } from './db.js';

export async function runRecurrenceEngine() {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentYear = currentDate.getFullYear();
  
  const runKey = `engine_run_${currentYear}_${currentMonth}`;
  
  // If already run for this month, skip
  if (localStorage.getItem(runKey)) {
    return;
  }
  
  console.log('Running Monthly Recurrence Engine...');
  
  const receitas = await db.getTable('receitas_fixas');
  const despesas = await db.getTable('despesas_fixas');
  
  // 1. Process Receitas Fixas
  for (const r of receitas) {
    const dataVencimento = new Date(currentYear, currentMonth - 1, r.dia_recebimento).toISOString().split('T')[0];
    
    await db.insert('lancamentos_mes', {
      valor: r.valor_estimado,
      data_vencimento: dataVencimento,
      categoria_id: null, // Receita doesn't necessarily have a category like expense
      descricao_custom: r.descricao,
      tipo_lancamento: 'RECEITA',
      pago_por: r.utilizador_id,
      regra_divisao: 'INDIVIDUAL',
      status: 'PENDENTE'
    });
  }
  
  // 2. Process Despesas Fixas
  for (const d of despesas) {
    const dataVencimento = new Date(currentYear, currentMonth - 1, d.dia_vencimento).toISOString().split('T')[0];
    
    await db.insert('lancamentos_mes', {
      valor: d.valor_estimado,
      data_vencimento: dataVencimento,
      categoria_id: d.categoria_id,
      descricao_custom: d.descricao,
      tipo_lancamento: 'DESPESA_FIXA',
      pago_por: d.pago_por_padrao,
      regra_divisao: d.regra_divisao,
      status: 'PENDENTE'
    });
  }
  
  localStorage.setItem(runKey, 'true');
  console.log('Recurrence Engine finished.');
}
