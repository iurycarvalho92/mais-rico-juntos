import { db } from '../db.js';
import { scanReceipt } from '../ai_scanner.js';
import { navigate } from '../../main.js';

export async function renderEntrada(container) {
  const users = await db.getTable('utilizadores');
  const categorias = await db.getTable('categorias');
  
  let currentDisplay = '0';
  
  const html = `
    <style>
      .numpad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin: 20px 0;
      }
      .num-btn {
        background: var(--surface-elevated);
        border: 1px solid var(--glass-border);
        color: var(--text-primary);
        font-size: 1.5rem;
        padding: 15px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: background 0.1s;
      }
      .num-btn:active {
        background: var(--primary-color);
      }
      .display-value {
        font-size: 3rem;
        text-align: center;
        font-weight: 700;
        margin-bottom: 20px;
        color: var(--primary-color);
      }
      .form-group {
        margin-bottom: 15px;
      }
      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-size: 0.85rem;
        color: var(--text-secondary);
      }
      .advanced-options {
        background: rgba(0,0,0,0.2);
        padding: 10px;
        border-radius: var(--radius-sm);
        margin-top: 10px;
      }
    </style>

    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h2 style="margin: 0;">Novo Lançamento</h2>
      <button id="btn-scan" class="btn btn-primary" style="width: auto; padding: 8px 16px; border-radius: 20px; display: flex; align-items: center; gap: 8px;">
        <span>📷</span> IA Scan
      </button>
    </div>
    
    <div class="display-value" id="val-display">R$ 0,00</div>
    
    <div id="ai-loading" style="display:none; text-align: center; color: var(--primary-color); margin-bottom: 20px;">
      <span style="font-size: 1.5rem; animation: pulse 1s infinite;">Processando imagem...</span>
    </div>

    <!-- Numpad -->
    <div class="numpad" id="numpad">
      <button class="num-btn">1</button>
      <button class="num-btn">2</button>
      <button class="num-btn">3</button>
      <button class="num-btn">4</button>
      <button class="num-btn">5</button>
      <button class="num-btn">6</button>
      <button class="num-btn">7</button>
      <button class="num-btn">8</button>
      <button class="num-btn">9</button>
      <button class="num-btn" style="color: var(--danger-color)">C</button>
      <button class="num-btn">0</button>
      <button class="num-btn">.</button>
    </div>
    
    <!-- Formulário -->
    <div class="card">
      <div class="form-group">
        <label>Descrição / Estabelecimento</label>
        <input type="text" id="input-desc" placeholder="Ex: Continente, Zomato..." />
      </div>
      
      <div class="form-group">
        <label>Categoria</label>
        <select id="select-cat">
          ${categorias.map(c => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('')}
        </select>
      </div>
      
      <div class="flex-between" style="gap: 15px;">
        <div class="form-group" style="flex: 1;">
          <label>Pago por / Responsável</label>
          <select id="select-payer">
            ${users.map(u => `<option value="${u.id}">${u.nome}</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group" style="flex: 1;">
          <label>Divisão</label>
          <select id="select-split">
            <option value="50_50">50 / 50</option>
            <option value="100_USER_A">100% ${users[0].nome}</option>
            <option value="100_USER_B">100% ${users[1].nome}</option>
          </select>
        </div>
      </div>
      
      <div class="form-group advanced-options">
        <label>Data do Lançamento</label>
        <input type="date" id="input-date" value="${new Date().toISOString().split('T')[0]}" />
        
        <label style="margin-top: 10px;">Repetição</label>
        <select id="select-repeat">
          <option value="unica">Única (Despesa Variável)</option>
          <option value="recorrente">Recorrente Mensal (Conta Fixa)</option>
          <option value="parcelada">Parcelada (Ex: 3x, 6x...)</option>
        </select>
        
        <div id="parcelas-container" style="display:none; margin-top:10px;">
          <label>Número de Meses/Parcelas</label>
          <input type="number" id="input-parcelas" value="2" min="2" max="48" />
        </div>
      </div>
      
      <button id="btn-save" class="btn btn-primary" style="margin-top: 10px;">Salvar Lançamento</button>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Logic
  const valDisplay = document.getElementById('val-display');
  const inputDesc = document.getElementById('input-desc');
  const selectCat = document.getElementById('select-cat');
  const selectPayer = document.getElementById('select-payer');
  const selectSplit = document.getElementById('select-split');
  const inputDate = document.getElementById('input-date');
  const selectRepeat = document.getElementById('select-repeat');
  const parcelasContainer = document.getElementById('parcelas-container');
  const inputParcelas = document.getElementById('input-parcelas');
  
  const aiLoading = document.getElementById('ai-loading');
  const numpad = document.getElementById('numpad');
  
  // Toggle Parcelas input
  selectRepeat.addEventListener('change', (e) => {
    parcelasContainer.style.display = e.target.value === 'parcelada' ? 'block' : 'none';
  });
  
  function updateDisplay() {
    const num = parseFloat(currentDisplay || '0');
    valDisplay.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  }
  
  // Numpad events
  container.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const char = e.target.textContent;
      if (char === 'C') {
        currentDisplay = '0';
      } else if (char === '.') {
        if (!currentDisplay.includes('.')) currentDisplay += '.';
      } else {
        if (currentDisplay === '0') currentDisplay = char;
        else currentDisplay += char;
      }
      updateDisplay();
    });
  });
  
  // AI Scan event
  document.getElementById('btn-scan').addEventListener('click', async () => {
    numpad.style.display = 'none';
    aiLoading.style.display = 'block';
    
    try {
      // Dummy image string for the demo, in a real app this opens a camera
      const data = await scanReceipt("dummy_base64_image");
      
      currentDisplay = data.valor_total.toString();
      updateDisplay();
      inputDesc.value = data.estabelecimento;
      
      const cat = categorias.find(c => c.nome.toLowerCase() === data.categoria_sugerida.toLowerCase());
      if (cat) selectCat.value = cat.id;
      
    } catch (e) {
      alert("Erro ao processar imagem");
    } finally {
      aiLoading.style.display = 'none';
      numpad.style.display = 'grid';
    }
  });
  
  // Save event
  document.getElementById('btn-save').addEventListener('click', async () => {
    const val = parseFloat(currentDisplay);
    if (isNaN(val) || val <= 0) {
      alert("Insira um valor válido.");
      return;
    }
    if (!inputDesc.value.trim()) {
      alert("Insira uma descrição.");
      return;
    }
    
    const selectedDate = new Date(inputDate.value);
    const today = new Date();
    // Reset hours to compare dates only
    today.setHours(0,0,0,0);
    // Adjust selected date due to timezone issues with value string
    const targetDate = new Date(selectedDate.getTime() + selectedDate.getTimezoneOffset() * 60000);
    
    const isFuture = targetDate > today;
    const status = isFuture ? 'PENDENTE' : 'PAGO';
    
    if (selectRepeat.value === 'recorrente') {
      // Salva como despesa fixa na tabela de configurações para os meses seguintes
      await db.insert('despesas_fixas', {
        categoria_id: parseInt(selectCat.value),
        descricao: inputDesc.value.trim(),
        valor_estimado: val,
        dia_vencimento: targetDate.getDate(),
        regra_divisao: selectSplit.value,
        pago_por_padrao: selectPayer.value
      });
      // Também gera o lançamento do mês atual
      await db.insert('lancamentos_mes', {
        valor: val,
        data_vencimento: inputDate.value,
        categoria_id: parseInt(selectCat.value),
        descricao_custom: inputDesc.value.trim(),
        tipo_lancamento: 'DESPESA_FIXA',
        pago_por: selectPayer.value,
        regra_divisao: selectSplit.value,
        status: status
      });
    } else if (selectRepeat.value === 'parcelada') {
      const numParcelas = parseInt(inputParcelas.value) || 2;
      for (let i = 0; i < numParcelas; i++) {
        const d = new Date(targetDate);
        d.setMonth(d.getMonth() + i);
        const dateStr = d.toISOString().split('T')[0];
        const isFutureParc = d > today;
        
        await db.insert('lancamentos_mes', {
          valor: val,
          data_vencimento: dateStr,
          categoria_id: parseInt(selectCat.value),
          descricao_custom: `${inputDesc.value.trim()} (${i+1}/${numParcelas})`,
          tipo_lancamento: 'DESPESA_VARIAVEL',
          pago_por: selectPayer.value,
          regra_divisao: selectSplit.value,
          status: isFutureParc ? 'PENDENTE' : 'PAGO'
        });
      }
    } else {
      // Única
      await db.insert('lancamentos_mes', {
        valor: val,
        data_vencimento: inputDate.value,
        categoria_id: parseInt(selectCat.value),
        descricao_custom: inputDesc.value.trim(),
        tipo_lancamento: 'DESPESA_VARIAVEL',
        pago_por: selectPayer.value,
        regra_divisao: selectSplit.value,
        status: status
      });
    }
    
    currentDisplay = '0';
    navigate('dashboard');
  });
}
