// Elementos do DOM
const runBtn = document.getElementById('runBtn');
const outputBox = document.getElementById('output');
const loading = document.getElementById('loading');
const successMessage = document.getElementById('successMessage');
const openFileBtn = document.getElementById('openFileBtn');
const newProcessBtn = document.getElementById('newProcessBtn');

// Variável global para armazenar o caminho do último arquivo gerado
let lastOutputPath = '';

// Executar automação completa
runBtn.addEventListener('click', async () => {
  // Reset UI
  outputBox.classList.remove('visible', 'success', 'error');
  successMessage.classList.remove('visible');
  loading.classList.add('visible');
  runBtn.disabled = true;
  outputBox.textContent = '';

  try {
    const result = await window.electronAPI.runFullAutomation();

    loading.classList.remove('visible');

    if (result.success) {
      showOutput(result.output, 'success');
      successMessage.classList.add('visible');

      // Mostrar caminho do arquivo e armazenar
      if (result.outputPath) {
        lastOutputPath = result.outputPath;
        const pathText = document.getElementById('outputPathText');
        pathText.textContent = `📁 Salvo em: ${result.outputPath}`;
      }
    }
  } catch (error) {
    loading.classList.remove('visible');
    showOutput(
      error.error || 'Erro desconhecido ao executar automação',
      'error'
    );
    runBtn.disabled = false;
  }
});

// Receber output do processo em tempo real
window.electronAPI.onAutomationOutput((data) => {
  outputBox.textContent += data;
  outputBox.scrollTop = outputBox.scrollHeight;
  outputBox.classList.add('visible');
});

// Receber erros do processo
window.electronAPI.onAutomationError((data) => {
  outputBox.textContent += `ERRO: ${data}`;
  outputBox.scrollTop = outputBox.scrollHeight;
  outputBox.classList.add('visible', 'error');
});

// Abrir arquivo gerado
openFileBtn.addEventListener('click', async () => {
  await window.electronAPI.openOutputFile(lastOutputPath);
});

// Novo processamento
newProcessBtn.addEventListener('click', () => {
  outputBox.classList.remove('visible', 'success', 'error');
  outputBox.textContent = '';
  successMessage.classList.remove('visible');
  runBtn.disabled = false;
});

// Função auxiliar para mostrar output
function showOutput(message, type = 'success') {
  outputBox.textContent = message;
  outputBox.classList.add('visible', type);
  outputBox.scrollTop = outputBox.scrollHeight;
}

// ==================== GERENCIAMENTO DE MOTOBOYS ====================

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const motoboysList = document.getElementById('motoboysList');
const addMotoboyBtn = document.getElementById('addMotoboyBtn');
const motoboyModal = document.getElementById('motoboyModal');
const closeModal = document.getElementById('closeModal');
const cancelModal = document.getElementById('cancelModal');
const saveMotoboyBtn = document.getElementById('saveMotoboyBtn');
const modalTitle = document.getElementById('modalTitle');

let currentMotoboys = [];
let editingIndex = -1;

// Trocar de tab
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.dataset.tab;

    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(`tab-${targetTab}`).classList.add('active');

    // Carregar motoboys ao abrir a tab
    if (targetTab === 'motoboys') {
      loadMotoboys();
    }
  });
});

// Carregar lista de motoboys
async function loadMotoboys() {
  motoboysList.innerHTML = `
    <div class="loading visible">
      <div class="spinner"></div>
      <p>Carregando motoboys...</p>
    </div>
  `;

  try {
    const result = await window.electronAPI.readMotoboys();

    if (result.success) {
      currentMotoboys = result.data;
      renderMotoboys();
    } else {
      motoboysList.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #dc3545;">
          Erro ao carregar motoboys: ${result.error}
        </div>
      `;
    }
  } catch (error) {
    motoboysList.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #dc3545;">
        Erro: ${error.message}
      </div>
    `;
  }
}

// Renderizar lista de motoboys
function renderMotoboys() {
  if (currentMotoboys.length === 0) {
    motoboysList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #6c757d;">
        <p style="font-size: 16px; margin-bottom: 10px;">📭 Nenhum motoboy cadastrado</p>
        <p style="font-size: 14px;">Clique em "Adicionar Motoboy" para começar</p>
      </div>
    `;
    return;
  }

  motoboysList.innerHTML = currentMotoboys.map((motoboy, index) => {
    const cidade = motoboy.cidade || '-';
    const bairro = motoboy.bairro || 'Toda cidade';
    const cep = motoboy.cep || '-';

    return `
      <div class="motoboy-item">
        <div class="motoboy-info">
          <div class="motoboy-name">${motoboy.nome_do_motoboy}</div>
          <div class="motoboy-details">
            📍 ${cidade} • ${bairro} ${cep !== '-' ? `• CEP: ${cep}` : ''}
          </div>
        </div>
        <div class="motoboy-actions">
          <button class="btn-secondary btn-icon" onclick="editMotoboy(${index})">
            ✏️ Editar
          </button>
          <button class="btn-danger btn-icon" onclick="deleteMotoboy(${index})">
            🗑️ Deletar
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Abrir modal para adicionar
addMotoboyBtn.addEventListener('click', () => {
  editingIndex = -1;
  modalTitle.textContent = 'Adicionar Motoboy';
  document.getElementById('motoboyNome').value = '';
  document.getElementById('motoboyCidade').value = '';
  document.getElementById('motoboyBairro').value = '';
  document.getElementById('motoboyCep').value = '';
  motoboyModal.classList.add('visible');
});

// Editar motoboy
window.editMotoboy = (index) => {
  editingIndex = index;
  const motoboy = currentMotoboys[index];

  modalTitle.textContent = 'Editar Motoboy';
  document.getElementById('motoboyNome').value = motoboy.nome_do_motoboy;
  document.getElementById('motoboyCidade').value = motoboy.cidade;
  document.getElementById('motoboyBairro').value = motoboy.bairro;
  document.getElementById('motoboyCep').value = motoboy.cep;
  motoboyModal.classList.add('visible');
};

// Fechar modal
closeModal.addEventListener('click', () => {
  motoboyModal.classList.remove('visible');
});

cancelModal.addEventListener('click', () => {
  motoboyModal.classList.remove('visible');
});

// Salvar motoboy
saveMotoboyBtn.addEventListener('click', async () => {
  const nome = document.getElementById('motoboyNome').value.trim();
  const cidade = document.getElementById('motoboyCidade').value.trim();
  const bairro = document.getElementById('motoboyBairro').value.trim();
  const cep = document.getElementById('motoboyCep').value.trim();

  if (!nome || !cidade) {
    alert('Nome e Cidade são obrigatórios!');
    return;
  }

  const motoboy = {
    nome_do_motoboy: nome,
    cidade: cidade,
    bairro: bairro,
    cep: cep
  };

  try {
    if (editingIndex === -1) {
      // Adicionar novo
      const result = await window.electronAPI.addMotoboy(motoboy);
      if (result.success) {
        motoboyModal.classList.remove('visible');
        loadMotoboys();
      } else {
        alert('Erro ao adicionar: ' + result.error);
      }
    } else {
      // Editar existente
      currentMotoboys[editingIndex] = motoboy;
      const result = await window.electronAPI.saveMotoboys(currentMotoboys);
      if (result.success) {
        motoboyModal.classList.remove('visible');
        loadMotoboys();
      } else {
        alert('Erro ao salvar: ' + result.error);
      }
    }
  } catch (error) {
    alert('Erro: ' + error.message);
  }
});

// Deletar motoboy
window.deleteMotoboy = async (index) => {
  const motoboy = currentMotoboys[index];
  const confirmDelete = confirm(
    `Tem certeza que deseja deletar "${motoboy.nome_do_motoboy}" de ${motoboy.cidade}?`
  );

  if (confirmDelete) {
    try {
      const result = await window.electronAPI.deleteMotoboy(index);
      if (result.success) {
        loadMotoboys();
      } else {
        alert('Erro ao deletar: ' + result.error);
      }
    } catch (error) {
      alert('Erro: ' + error.message);
    }
  }
};

// ==================== SCANNER QR CODE ====================

const scannerInput = document.getElementById('scannerInput');
const searchBtn = document.getElementById('searchBtn');
const clearScannerBtn = document.getElementById('clearScannerBtn');
const scannerResult = document.getElementById('scannerResult');
const scannerNotFound = document.getElementById('scannerNotFound');
const scannerError = document.getElementById('scannerError');
const motoboyName = document.getElementById('motoboyName');
const deliveryDetails = document.getElementById('deliveryDetails');
const searchedCode = document.getElementById('searchedCode');
const scannerErrorMessage = document.getElementById('scannerErrorMessage');

// Função para processar código bipado
function processScannedCode(rawCode) {
  // Tentar parsear como JSON
  try {
    const parsed = JSON.parse(rawCode);
    // Se for JSON válido e tiver campo 'id', retornar o id
    if (parsed && parsed.id) {
      return {
        searchCode: parsed.id,
        originalCode: rawCode,
        type: 'CODIGO1',
        isJson: true
      };
    }
  } catch (e) {
    // Não é JSON, continuar com lógica normal
  }

  // Se começar com BR, é CODIGO2
  if (rawCode.toUpperCase().startsWith('BR')) {
    return {
      searchCode: rawCode,
      originalCode: rawCode,
      type: 'CODIGO2',
      isJson: false
    };
  }

  // Caso contrário, é CODIGO1
  return {
    searchCode: rawCode,
    originalCode: rawCode,
    type: 'CODIGO1',
    isJson: false
  };
}

// Função para buscar código
async function searchDeliveryCode() {
  const rawCode = scannerInput.value.trim();

  if (!rawCode) {
    alert('Por favor, digite ou bipe um código!');
    return;
  }

  // Processar código bipado
  const codeInfo = processScannedCode(rawCode);

  // Ocultar todos os resultados
  scannerResult.style.display = 'none';
  scannerNotFound.style.display = 'none';
  scannerError.style.display = 'none';

  // Desabilitar input e botão durante busca
  scannerInput.disabled = true;
  searchBtn.disabled = true;
  searchBtn.textContent = '🔍 Buscando...';

  try {
    const result = await window.electronAPI.searchDeliveryByCode(codeInfo.searchCode);

    if (result.success && result.delivery) {
      // Encontrado!
      motoboyName.textContent = result.delivery.motoboy;

      const details = [];

      // Mostrar qual código foi usado
      if (codeInfo.isJson) {
        details.push(`🔖 ${codeInfo.type}: ${codeInfo.searchCode} (extraído do JSON)`);
      } else {
        details.push(`🔖 ${codeInfo.type}: ${codeInfo.searchCode}`);
      }

      if (result.delivery.cidade) details.push(`📍 ${result.delivery.cidade}`);
      if (result.delivery.bairro) details.push(`${result.delivery.bairro}`);
      if (result.delivery.logradouro) details.push(`${result.delivery.logradouro}`);

      deliveryDetails.innerHTML = details.join('<br>') || 'Sem detalhes adicionais';

      scannerResult.style.display = 'block';

      // Foco automático no input após 2 segundos
      setTimeout(() => {
        scannerInput.value = '';
        scannerInput.focus();
      }, 2000);
    } else {
      // Não encontrado
      searchedCode.textContent = codeInfo.searchCode;
      scannerNotFound.style.display = 'block';
    }
  } catch (error) {
    // Erro na busca
    scannerErrorMessage.textContent = error.message || 'Erro desconhecido ao buscar código.';
    scannerError.style.display = 'block';
  } finally {
    // Re-habilitar input e botão
    scannerInput.disabled = false;
    searchBtn.disabled = false;
    searchBtn.textContent = '🔍 Buscar';
  }
}

// Buscar ao clicar no botão
searchBtn.addEventListener('click', searchDeliveryCode);

// Buscar ao pressionar Enter
scannerInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchDeliveryCode();
  }
});

// Buffer para acumular caracteres do scanner
let scanBuffer = '';
let scanTimeout = null;
let isScanning = false;

// Interceptar PASTE
scannerInput.addEventListener('paste', (e) => {
  e.preventDefault();
  const pastedText = (e.clipboardData || window.clipboardData).getData('text');
  console.log('📋 Paste:', pastedText);

  const idMatch = pastedText.match(/"id"\s*:\s*"?(\d+)"?/);
  if (idMatch && idMatch[1]) {
    console.log('✅ ID extraído:', idMatch[1]);
    scannerInput.value = idMatch[1];
    setTimeout(() => searchDeliveryCode(), 100);
  } else {
    scannerInput.value = pastedText;
  }
});

// Interceptar keydown ANTES do caractere ser inserido
scannerInput.addEventListener('keydown', (e) => {
  // Se está escaneando, acumular no buffer
  if (e.key.length === 1 || e.key === 'Enter') {
    isScanning = true;

    // Limpar timeout anterior
    if (scanTimeout) {
      clearTimeout(scanTimeout);
    }

    // Se não é Enter, acumular caractere
    if (e.key !== 'Enter') {
      scanBuffer += e.key;
    }

    // Timeout para detectar fim do scan (scanner é muito rápido, usuário é lento)
    scanTimeout = setTimeout(() => {
      // Verificar se o buffer contém JSON
      if (scanBuffer.includes('{') && scanBuffer.includes('"id"')) {
        console.log('🔍 JSON detectado no buffer:', scanBuffer);

        const idMatch = scanBuffer.match(/"id"\s*:\s*"?(\d+)"?/);

        if (idMatch && idMatch[1]) {
          // PREVENIR que o JSON apareça no campo
          e.preventDefault();

          const extractedId = idMatch[1];
          console.log('✅ ID extraído:', extractedId);

          // Limpar campo e colocar apenas o ID
          scannerInput.value = extractedId;

          // Buscar automaticamente
          setTimeout(() => {
            searchDeliveryCode();
          }, 100);
        }
      }

      // Resetar buffer
      scanBuffer = '';
      isScanning = false;
    }, 50); // Scanner digita tudo em menos de 50ms
  }
});

// Fallback: monitorar input caso keydown não funcione
let inputCheckTimeout;
scannerInput.addEventListener('input', (e) => {
  if (inputCheckTimeout) clearTimeout(inputCheckTimeout);

  inputCheckTimeout = setTimeout(() => {
    const value = e.target.value;

    if (value.includes('{') && value.includes('"id"')) {
      console.log('🔍 JSON detectado no input (fallback)');

      const idMatch = value.match(/"id"\s*:\s*"?(\d+)"?/);

      if (idMatch && idMatch[1]) {
        console.log('✅ ID extraído (fallback):', idMatch[1]);
        scannerInput.value = idMatch[1];
        setTimeout(() => searchDeliveryCode(), 100);
      }
    }
  }, 100);
});

// Limpar e focar no input
clearScannerBtn.addEventListener('click', () => {
  scannerInput.value = '';
  scannerResult.style.display = 'none';
  scannerNotFound.style.display = 'none';
  scannerError.style.display = 'none';
  scannerInput.focus();
});

// Auto-focar no input quando abrir a tab scanner
tabBtns.forEach(btn => {
  const originalClick = btn.onclick;
  btn.addEventListener('click', () => {
    const targetTab = btn.dataset.tab;
    if (targetTab === 'scanner') {
      setTimeout(() => {
        scannerInput.focus();
      }, 100);
    }
  });
});
