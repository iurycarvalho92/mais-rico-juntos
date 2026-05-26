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
    </style>

    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h2 style="margin: 0;">Novo Gasto</h2>
      <button id="btn-scan" class="btn btn-primary" style="width: auto; padding: 8px 16px; border-radius: 20px; display: flex; align-items: center; gap: 8px;">
        <span>📷</span> IA Scan
      </button>
    </div>
    
    <div class="display-value" id="val-display">€0,00</div>
    
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
          <label>Pago por</label>
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
      
      <button id="btn-save" class="btn btn-primary" style="margin-top: 10px;">Guardar Lançamento</button>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Logic
  const valDisplay = document.getElementById('val-display');
  const inputDesc = document.getElementById('input-desc');
  const selectCat = document.getElementById('select-cat');
  const selectPayer = document.getElementById('select-payer');
  const selectSplit = document.getElementById('select-split');
  const aiLoading = document.getElementById('ai-loading');
  const numpad = document.getElementById('numpad');
  
  function updateDisplay() {
    const num = parseFloat(currentDisplay || '0');
    valDisplay.textContent = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(num);
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
      const data = await scanReceipt();
      
      // Fill data
      currentDisplay = data.valor_total.toString();
      updateDisplay();
      
      inputDesc.value = data.estabelecimento;
      
      // Find category ID by name
      const cat = categorias.find(c => c.nome.toLowerCase() === data.categoria_sugerida.toLowerCase());
      if (cat) {
        selectCat.value = cat.id;
      }
      
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
    
    const today = new Date().toISOString().split('T')[0];
    
    await db.insert('lancamentos_mes', {
      valor: val,
      data_vencimento: today,
      categoria_id: parseInt(selectCat.value),
      descricao_custom: inputDesc.value.trim(),
      tipo_lancamento: 'DESPESA_VARIAVEL',
      pago_por: selectPayer.value,
      regra_divisao: selectSplit.value,
      status: 'PAGO' // New custom transactions are usually paid instantly
    });
    
    // Reset and navigate back
    currentDisplay = '0';
    navigate('dashboard');
  });
}
