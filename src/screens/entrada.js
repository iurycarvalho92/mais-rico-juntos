import { db } from '../db.js';
import { f, toLocalDateStr, withLoading } from '../utils.js';
import { navigate } from '../../main.js';

export async function renderEntrada(container) {
  const [users, categorias] = await Promise.all([
    db.getTable('utilizadores'),
    db.getTable('categorias')
  ]);
  
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
      .slider-container {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 5px;
      }
      .slider-label {
        font-size: 0.8rem;
        font-weight: bold;
        color: var(--primary-color);
        text-align: center;
        margin-top: 5px;
      }
    </style>

    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h2 style="margin: 0;">Novo Lançamento</h2>
      <label id="btn-scan" class="btn btn-primary" style="width: auto; padding: 8px 16px; border-radius: 20px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
        <span>📷</span> IA Scan
        <input type="file" id="scan-file-input" accept="image/*" capture="camera" style="display: none;" />
      </label>
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
          <label>Divisão da Despesa</label>
          <div class="slider-container">
            <span style="font-size: 0.75rem; color: var(--text-secondary);">${users[0]?.nome.charAt(0) || 'A'}</span>
            <input type="range" id="input-split-slider" min="0" max="100" value="50" style="flex: 1;" />
            <span style="font-size: 0.75rem; color: var(--text-secondary);">${users[1]?.nome.charAt(0) || 'B'}</span>
          </div>
          <div class="slider-label" id="split-label">50% / 50%</div>
        </div>
      </div>
      
      <div class="form-group advanced-options">
        <label>Data do Lançamento</label>
        <input type="date" id="input-date" value="${toLocalDateStr(new Date())}" />
        
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
  
  const valDisplay = document.getElementById('val-display');
  const inputDesc = document.getElementById('input-desc');
  const selectCat = document.getElementById('select-cat');
  const selectPayer = document.getElementById('select-payer');
  const splitSlider = document.getElementById('input-split-slider');
  const splitLabel = document.getElementById('split-label');
  const inputDate = document.getElementById('input-date');
  const selectRepeat = document.getElementById('select-repeat');
  const parcelasContainer = document.getElementById('parcelas-container');
  const inputParcelas = document.getElementById('input-parcelas');
  const aiLoading = document.getElementById('ai-loading');
  const numpad = document.getElementById('numpad');
  const btnSave = document.getElementById('btn-save');
  
  selectRepeat.addEventListener('change', (e) => {
    parcelasContainer.style.display = e.target.value === 'parcelada' ? 'block' : 'none';
  });
  
  function updateDisplay() {
    const num = parseFloat(currentDisplay || '0');
    valDisplay.textContent = f.format(num);
    updateSplitLabel();
  }
  
  // ✅ FIX: Função de split centralizada (evita duplicação)
  function updateSplitLabel() {
    const percent2 = parseInt(splitSlider.value);
    const percent1 = 100 - percent2;
    const num = parseFloat(currentDisplay || '0');
    
    if (num > 0) {
      const val1 = num * (percent1 / 100);
      const val2 = num * (percent2 / 100);
      splitLabel.innerHTML = `${users[0]?.nome}: <span style="color:var(--text-primary)">${f.format(val1)}</span> | ${users[1]?.nome}: <span style="color:var(--text-primary)">${f.format(val2)}</span>`;
    } else {
      splitLabel.textContent = `${percent1}% ${users[0]?.nome || 'A'} / ${percent2}% ${users[1]?.nome || 'B'}`;
    }
  }
  
  updateSplitLabel();
  splitSlider.addEventListener('input', updateSplitLabel);
  
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
  
  // ✅ FIX: AI Scan agora abre câmera real
  document.getElementById('scan-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    numpad.style.display = 'none';
    aiLoading.style.display = 'block';
    
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1];
        try {
          const { scanReceipt } = await import('../ai_scanner.js');
          const data = await scanReceipt(base64);
          currentDisplay = data.valor_total.toString();
          updateDisplay();
          inputDesc.value = data.estabelecimento;
          const cat = categorias.find(c => c.nome.toLowerCase() === data.categoria_sugerida.toLowerCase());
          if (cat) selectCat.value = cat.id;
        } catch (err) {
          alert('Erro ao processar imagem: ' + err.message);
        } finally {
          aiLoading.style.display = 'none';
          numpad.style.display = 'grid';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Erro ao ler arquivo.');
      aiLoading.style.display = 'none';
      numpad.style.display = 'grid';
    }
  });
  
  // ✅ FIX: withLoading evita duplo clique
  btnSave.addEventListener('click', async () => {
    const val = parseFloat(currentDisplay);
    if (isNaN(val) || val <= 0) {
      alert('Insira um valor válido.');
      return;
    }
    if (!inputDesc.value.trim()) {
      alert('Insira uma descrição.');
      return;
    }
    
    // ✅ FIX: Usar toLocalDateStr para evitar bug de fuso horário nas parcelas
    const targetDate = new Date(inputDate.value + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFuture = targetDate > today;
    const status = isFuture ? 'PENDENTE' : 'PAGO';
    
    await withLoading(btnSave, async () => {
      if (selectRepeat.value === 'recorrente') {
        await db.insert('despesas_fixas', {
          categoria_id: parseInt(selectCat.value),
          descricao: inputDesc.value.trim(),
          valor_estimado: val,
          dia_vencimento: targetDate.getDate(),
          regra_divisao_percent: parseInt(splitSlider.value),
          pago_por_padrao: selectPayer.value
        });
        await db.insert('lancamentos_mes', {
          valor: val,
          data_vencimento: inputDate.value,
          categoria_id: parseInt(selectCat.value),
          descricao_custom: inputDesc.value.trim(),
          tipo_lancamento: 'DESPESA_FIXA',
          pago_por: selectPayer.value,
          regra_divisao_percent: parseInt(splitSlider.value),
          status: status
        });
      } else if (selectRepeat.value === 'parcelada') {
        const numParcelas = parseInt(inputParcelas.value) || 2;
        const valParcela = val / numParcelas;
        for (let i = 0; i < numParcelas; i++) {
          const d = new Date(targetDate);
          d.setMonth(d.getMonth() + i);
          // ✅ FIX: toLocalDateStr evita o bug de fuso horário
          const dateStr = toLocalDateStr(d);
          const isFutureParc = d > today;
          
          await db.insert('lancamentos_mes', {
            valor: valParcela,
            valor_total: val,
            data_vencimento: dateStr,
            categoria_id: parseInt(selectCat.value),
            descricao_custom: `${inputDesc.value.trim()} (${i+1}/${numParcelas})`,
            tipo_lancamento: 'DESPESA_VARIAVEL',
            pago_por: selectPayer.value,
            regra_divisao_percent: parseInt(splitSlider.value),
            status: isFutureParc ? 'PENDENTE' : 'PAGO'
          });
        }
      } else {
        await db.insert('lancamentos_mes', {
          valor: val,
          data_vencimento: inputDate.value,
          categoria_id: parseInt(selectCat.value),
          descricao_custom: inputDesc.value.trim(),
          tipo_lancamento: 'DESPESA_VARIAVEL',
          pago_por: selectPayer.value,
          regra_divisao_percent: parseInt(splitSlider.value),
          status: status
        });
      }
      currentDisplay = '0';
      navigate('dashboard');
    });
  });
}
