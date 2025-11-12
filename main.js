const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('index.html');

  // Abre DevTools em desenvolvimento
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Limpar pasta downloads
async function cleanupBeforeRun() {
  const downloadDir = path.join(__dirname, 'downloads');

  // Limpar pasta downloads
  if (fs.existsSync(downloadDir)) {
    const files = fs.readdirSync(downloadDir);
    for (const file of files) {
      const filePath = path.join(downloadDir, file);
      try {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Arquivo removido: ${file}`);
      } catch (err) {
        console.error(`Erro ao remover ${file}:`, err.message);
      }
    }
  }
}

// Criar pasta entregas e retornar caminho
function getOutputDirectory() {
  const documentsPath = app.getPath('documents');
  const entregasDir = path.join(documentsPath, 'entregas');

  // Criar pasta se não existir
  if (!fs.existsSync(entregasDir)) {
    fs.mkdirSync(entregasDir, { recursive: true });
    console.log('📁 Pasta "entregas" criada em Documentos');
  }

  return entregasDir;
}

// Obter caminho do arquivo motoboys.csv (em userData)
function getMotoboysCsvPath() {
  const userDataPath = app.getPath('userData');
  const csvPath = path.join(userDataPath, 'motoboys.csv');

  // Se o arquivo não existir em userData, copiar do bundle
  if (!fs.existsSync(csvPath)) {
    try {
      // Em desenvolvimento, usar __dirname
      // Em produção, usar process.resourcesPath
      const sourcePath = app.isPackaged
        ? path.join(process.resourcesPath, 'motoboys.csv')
        : path.join(__dirname, 'motoboys.csv');

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, csvPath);
        console.log('📋 Arquivo motoboys.csv copiado para userData');
      } else {
        // Se não encontrar o arquivo, criar um arquivo vazio com cabeçalho
        const headers = 'nome_do_motoboy,cidade,bairro,cep\n';
        fs.writeFileSync(csvPath, headers, 'utf-8');
        console.log('📋 Arquivo motoboys.csv criado em userData');
      }
    } catch (error) {
      console.error('Erro ao preparar motoboys.csv:', error);
    }
  }

  return csvPath;
}

// Executar o fluxo completo: baixar arquivo + processar
ipcMain.handle('run-full-automation', async (event) => {
  console.log('========== INICIANDO AUTOMAÇÃO ==========');
  console.log('Platform:', process.platform);
  console.log('App Path:', app.getPath('exe'));
  console.log('__dirname:', __dirname);
  console.log('Is Packaged:', app.isPackaged);
  console.log('Process CWD:', process.cwd());

  // Limpar arquivos antigos antes de iniciar
  await cleanupBeforeRun();
  event.sender.send('automation-output', '🗑️  Limpeza de arquivos concluída\n');
  event.sender.send('automation-output', '🚀 Iniciando automação...\n\n');

  return new Promise((resolve, reject) => {
    // Determinar diretório de saída
    const outputDir = getOutputDirectory();
    console.log('Output Directory:', outputDir);

    // Caminho do motoboys.csv em userData
    const motoboysCsvPath = getMotoboysCsvPath();
    console.log('Motoboys CSV Path:', motoboysCsvPath);
    console.log('Motoboys CSV exists:', fs.existsSync(motoboysCsvPath));

    // Determinar qual script executar baseado se está empacotado ou não
    let scriptProcess;
    let scriptCommand;
    let scriptArgs;

    if (app.isPackaged) {
      // Em produção: usar node para executar o JS compilado
      const scriptPath = path.join(__dirname, 'dist-scripts', 'script-logmanager.js');
      console.log('Script Path (produção):', scriptPath);
      console.log('Script exists:', fs.existsSync(scriptPath));

      // Caminho absoluto do executável Python
      const pythonProcessorPath = path.join(process.resourcesPath, 'previa_processor.exe');
      console.log('Python Processor Path:', pythonProcessorPath);
      console.log('Python Processor exists:', fs.existsSync(pythonProcessorPath));

      // Caminho dos browsers do Playwright (empacotados no app)
      const playwrightBrowsersPath = path.join(__dirname, 'node_modules', 'playwright', '.local-browsers');
      console.log('Playwright Browsers Path:', playwrightBrowsersPath);
      console.log('Playwright Browsers exists:', fs.existsSync(playwrightBrowsersPath));

      scriptCommand = 'node';
      scriptArgs = [scriptPath];

      scriptProcess = spawn(scriptCommand, scriptArgs, {
        cwd: __dirname,
        env: {
          ...process.env,
          OUTPUT_DIR: outputDir,
          MOTOBOYS_CSV_PATH: motoboysCsvPath,
          PYTHON_SCRIPT: pythonProcessorPath,
          PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath
        }
      });
    } else {
      // Em desenvolvimento: usar tsx para executar o TS
      const scriptPath = path.join(__dirname, 'script-logmanager.ts');
      console.log('Script Path (dev):', scriptPath);
      console.log('Script exists:', fs.existsSync(scriptPath));

      scriptCommand = 'npx';
      scriptArgs = ['tsx', 'script-logmanager.ts'];

      scriptProcess = spawn(scriptCommand, scriptArgs, {
        cwd: __dirname,
        env: {
          ...process.env,
          OUTPUT_DIR: outputDir,
          MOTOBOYS_CSV_PATH: motoboysCsvPath
        }
      });
    }

    console.log('Comando:', scriptCommand, scriptArgs.join(' '));
    console.log('==========================================');

    const tsProcess = scriptProcess;

    let output = '';
    let errorOutput = '';

    tsProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      event.sender.send('automation-output', text);
    });

    tsProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      event.sender.send('automation-error', text);

      // Log adicional no console do Electron para debug
      console.error('[STDERR]', text);
    });

    tsProcess.on('close', (code) => {
      console.log(`[PROCESSO] Finalizado com código: ${code}`);
      console.log(`[OUTPUT LENGTH] stdout: ${output.length}, stderr: ${errorOutput.length}`);

      if (code === 0) {
        // Extrair o caminho do arquivo da saída do script
        const pathMatch = output.match(/📄 Arquivo salvo em: (.+\.xlsx)/);
        const finalPath = pathMatch ? pathMatch[1] : '';

        // Procurar pelo arquivo de log gerado
        const logMatch = output.match(/📋 Log completo salvo em: (.+\.log)/);
        const logPath = logMatch ? logMatch[1] : '';

        resolve({
          success: true,
          output: output,
          outputPath: finalPath,
          logPath: logPath
        });
      } else {
        // Montar mensagem de erro detalhada
        let errorMessage = `Processo finalizado com código ${code}\n\n`;

        if (errorOutput) {
          errorMessage += `STDERR:\n${errorOutput}\n\n`;
        }

        if (output) {
          errorMessage += `STDOUT:\n${output}\n`;
        }

        // Procurar arquivo de log no output
        const logMatch = output.match(/📋 Log completo salvo em: (.+\.log)/);
        if (logMatch) {
          errorMessage += `\n📋 Veja o log completo em: ${logMatch[1]}`;
        }

        console.error('[ERRO DETALHADO]', errorMessage);

        reject({
          success: false,
          error: errorMessage || 'Erro ao executar automação completa'
        });
      }
    });

    tsProcess.on('error', (error) => {
      const errorDetails = {
        message: error.message,
        code: error.code,
        path: error.path,
        stack: error.stack,
        syscall: error.syscall
      };

      console.error('[ERRO AO INICIAR PROCESSO]', errorDetails);

      let errorMessage = `Erro ao iniciar processo:\n`;
      errorMessage += `Mensagem: ${error.message}\n`;
      if (error.code) errorMessage += `Código: ${error.code}\n`;
      if (error.path) errorMessage += `Caminho: ${error.path}\n`;
      if (error.syscall) errorMessage += `Syscall: ${error.syscall}\n`;

      reject({
        success: false,
        error: errorMessage
      });
    });
  });
});

// Abrir arquivo de saída
ipcMain.handle('open-output-file', async (event, filePath) => {
  const { shell } = require('electron');

  try {
    // Se não passou caminho, tenta abrir a pasta entregas
    if (!filePath) {
      const outputDir = getOutputDirectory();
      await shell.openPath(outputDir);
    } else {
      await shell.openPath(filePath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Ler arquivo motoboys.csv
ipcMain.handle('read-motoboys', async () => {
  const csvPath = getMotoboysCsvPath();

  try {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');

    const motoboys = lines.slice(1).map((line, index) => {
      const values = line.split(',');
      return {
        id: index,
        nome_do_motoboy: values[0] || '',
        cidade: values[1] || '',
        bairro: values[2] || '',
        cep: values[3] || ''
      };
    });

    return { success: true, data: motoboys };
  } catch (error) {
    return { success: false, error: `Erro ao carregar motoboys: ${error.code}, ${error.message}` };
  }
});

// Salvar arquivo motoboys.csv
ipcMain.handle('save-motoboys', async (event, motoboys) => {
  const csvPath = getMotoboysCsvPath();

  try {
    const headers = 'nome_do_motoboy,cidade,bairro,cep\n';
    const rows = motoboys.map(m =>
      `${m.nome_do_motoboy},${m.cidade},${m.bairro},${m.cep}`
    ).join('\n');

    fs.writeFileSync(csvPath, headers + rows, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Adicionar motoboy
ipcMain.handle('add-motoboy', async (event, motoboy) => {
  const csvPath = getMotoboysCsvPath();

  try {
    const row = `\n${motoboy.nome_do_motoboy},${motoboy.cidade},${motoboy.bairro},${motoboy.cep}`;
    fs.appendFileSync(csvPath, row, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Deletar motoboy (por índice)
ipcMain.handle('delete-motoboy', async (event, index) => {
  const csvPath = getMotoboysCsvPath();

  try {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    // Remove a linha no índice especificado (índice + 1 por causa do header)
    lines.splice(index + 1, 1);

    fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Buscar entrega por código
ipcMain.handle('search-delivery-by-code', async (event, code) => {
  const xlsx = require('xlsx');

  try {
    const outputDir = getOutputDirectory();

    // Listar todos os arquivos XLSX na pasta entregas
    const files = fs.readdirSync(outputDir)
      .filter(file => file.endsWith('.xlsx'))
      .map(file => ({
        name: file,
        path: path.join(outputDir, file),
        mtime: fs.statSync(path.join(outputDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime); // Ordenar por data, mais recente primeiro

    if (files.length === 0) {
      return {
        success: false,
        error: 'Nenhuma planilha de entregas encontrada. Execute a automação primeiro.'
      };
    }

    // Usar o arquivo mais recente
    const latestFile = files[0];
    console.log('📋 Buscando em:', latestFile.name);

    // Ler o arquivo Excel
    const workbook = xlsx.readFile(latestFile.path);

    // Assumir que a primeira sheet é "Entregas"
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Converter para JSON
    const data = xlsx.utils.sheet_to_json(worksheet);

    const searchCode = String(code).trim();

    // Determinar qual coluna buscar baseado no código
    // Se começar com BR (case-insensitive), buscar em CODIGO2, caso contrário em CODIGO1
    const searchInCodigo2 = searchCode.toUpperCase().startsWith('BR');
    const columnToSearch = searchInCodigo2 ? 'CODIGO2' : 'CODIGO1';

    console.log(`🔍 Código recebido: "${searchCode}"`);
    console.log(`🔍 Buscando na coluna: ${columnToSearch}`);

    // Buscar pelo código na coluna apropriada
    const delivery = data.find(row => {
      // Converter para string e normalizar para comparação (case-insensitive)
      const rowCode = String(row[columnToSearch] || '').trim().toUpperCase();
      const searchCodeUpper = searchCode.toUpperCase();
      return rowCode === searchCodeUpper;
    });

    if (delivery) {
      return {
        success: true,
        delivery: {
          codigo1: delivery.CODIGO1,
          codigo2: delivery.CODIGO2,
          motoboy: delivery.MOTOBOY || 'SEM MOTOBOY',
          cep: delivery.CEP,
          bairro: delivery.BAIRRO,
          cidade: delivery.CIDADE,
          logradouro: delivery.LOGRADOURO,
          numero: delivery.NÚMERO
        }
      };
    } else {
      return {
        success: false,
        error: `Código não encontrado na coluna ${columnToSearch}.`
      };
    }
  } catch (error) {
    console.error('Erro ao buscar código:', error);
    return {
      success: false,
      error: `Erro ao buscar código: ${error.message}`
    };
  }
});
