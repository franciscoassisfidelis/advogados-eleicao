import { supabase } from './supabaseClient.js';

const form = document.getElementById('form-cadastro');
const areaFormulario = document.getElementById('area-formulario');
const telaSucesso = document.getElementById('tela-sucesso');
const municipioSelect = document.getElementById('municipio');
const zonaBox = document.getElementById('zona-box');
const cpfInput = document.getElementById('cpf');
const telefoneInput = document.getElementById('telefone');
const docInput = document.getElementById('documento_oab');
const arquivoSelecionado = document.getElementById('arquivo-selecionado');
const mensagem = document.getElementById('mensagem');
const btnEnviar = document.getElementById('btn-enviar');
const listaApoio = document.getElementById('lista-municipios-apoio');
const btnAddApoio = document.getElementById('btn-add-apoio');

let municipiosZonas = new Map(); // municipio -> zonas[]
let todosMunicipios = [];

// ---------------------------------------------------------------------
// Carrega a lista de municípios (e zonas) do Supabase
// ---------------------------------------------------------------------
async function carregarMunicipios() {
  const { data, error } = await supabase
    .from('municipios_zonas')
    .select('municipio, zonas')
    .order('municipio', { ascending: true });

  if (error) {
    municipioSelect.innerHTML = '<option value="" disabled selected>Erro ao carregar municípios — recarregue a página</option>';
    console.error(error);
    return;
  }

  municipioSelect.innerHTML = '<option value="" disabled selected>Selecione o município</option>';
  for (const row of data) {
    municipiosZonas.set(row.municipio, row.zonas || []);
    todosMunicipios.push(row.municipio);
    const opt = document.createElement('option');
    opt.value = row.municipio;
    opt.textContent = row.municipio;
    municipioSelect.appendChild(opt);
  }
}

// ---------------------------------------------------------------------
// Município(s) de apoio — linhas repetíveis, opcionais
// ---------------------------------------------------------------------
function opcoesMunicipios(selecionado) {
  let html = '<option value="">Selecione um município</option>';
  for (const nome of todosMunicipios) {
    html += `<option value="${nome}" ${nome === selecionado ? 'selected' : ''}>${nome}</option>`;
  }
  return html;
}

function textoZona(zonas) {
  if (!zonas || zonas.length === 0) return 'Zona eleitoral a confirmar.';
  if (zonas.length === 1) return `Zona eleitoral: ${zonas[0]}ª Zona.`;
  return `Abrange ${zonas.length} zonas eleitorais: ${zonas.map((z) => `${z}ª`).join(', ')}.`;
}

function criarLinhaApoio() {
  const item = document.createElement('div');
  item.className = 'item-municipio-apoio';
  item.innerHTML = `
    <div class="linha-municipio-apoio">
      <select class="select-municipio-apoio">${opcoesMunicipios('')}</select>
      <button type="button" class="btn-remover-apoio" title="Remover">×</button>
    </div>
    <div class="zona-apoio-texto"></div>
  `;
  const select = item.querySelector('.select-municipio-apoio');
  const zonaTexto = item.querySelector('.zona-apoio-texto');
  select.addEventListener('change', () => {
    zonaTexto.textContent = select.value ? textoZona(municipiosZonas.get(select.value)) : '';
  });
  item.querySelector('.btn-remover-apoio').addEventListener('click', () => item.remove());
  listaApoio.appendChild(item);
}

btnAddApoio.addEventListener('click', () => criarLinhaApoio());

municipioSelect.addEventListener('change', () => {
  const zonas = municipiosZonas.get(municipioSelect.value) || [];
  if (!municipioSelect.value) {
    zonaBox.className = 'zona-box';
    return;
  }
  if (zonas.length === 0) {
    zonaBox.className = 'zona-box ativo alerta';
    zonaBox.innerHTML = 'Zona eleitoral ainda não confirmada para este município. A Coordenação Jurídica irá confirmar com você.';
  } else if (zonas.length === 1) {
    zonaBox.className = 'zona-box ativo';
    zonaBox.innerHTML = `Zona eleitoral: <strong>${zonas[0]}ª Zona</strong>`;
  } else {
    zonaBox.className = 'zona-box ativo';
    zonaBox.innerHTML = `Este município abrange <strong>${zonas.length} zonas eleitorais</strong>: ${zonas.map((z) => `${z}ª`).join(', ')}`;
  }
});

// ---------------------------------------------------------------------
// Máscaras simples
// ---------------------------------------------------------------------
cpfInput.addEventListener('input', () => {
  let v = cpfInput.value.replace(/\D/g, '').slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  cpfInput.value = v;
});

telefoneInput.addEventListener('input', () => {
  let v = telefoneInput.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10) {
    v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (v.length > 5) {
    v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else if (v.length > 2) {
    v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  }
  telefoneInput.value = v;
});

docInput.addEventListener('change', () => {
  const file = docInput.files[0];
  arquivoSelecionado.textContent = file ? `Selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : '';
});

// ---------------------------------------------------------------------
// Validação de CPF (algoritmo padrão de dígitos verificadores)
// ---------------------------------------------------------------------
function cpfValido(cpfFormatado) {
  const cpf = cpfFormatado.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[9], 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf[10], 10);
}

// ---------------------------------------------------------------------
// Validação e envio do formulário
// ---------------------------------------------------------------------
function limparErros() {
  document.querySelectorAll('.erro-texto').forEach((el) => {
    el.textContent = '';
    el.classList.remove('ativo');
  });
  document.querySelectorAll('.campo-erro').forEach((el) => el.classList.remove('campo-erro'));
  mensagem.className = 'mensagem';
  mensagem.textContent = '';
}

function marcarErro(campo, texto) {
  const el = document.querySelector(`[data-erro-de="${campo}"]`);
  if (el) {
    el.textContent = texto;
    el.classList.add('ativo');
  }
  const input = document.getElementById(campo);
  if (input) input.classList.add('campo-erro');
}

function validar(dados, arquivo) {
  let ok = true;

  if (!dados.nome_completo || dados.nome_completo.trim().length < 3) {
    marcarErro('nome_completo', 'Informe o nome completo.');
    ok = false;
  }
  if (!cpfValido(dados.cpf)) {
    marcarErro('cpf', 'CPF inválido. Confira os números digitados.');
    ok = false;
  }
  if (!dados.oab_numero || !dados.oab_numero.trim()) {
    marcarErro('oab_numero', 'Informe o número de inscrição na OAB.');
    ok = false;
  }
  const telefoneDigitos = dados.telefone.replace(/\D/g, '');
  if (telefoneDigitos.length < 10) {
    marcarErro('telefone', 'Informe um telefone válido com DDD.');
    ok = false;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dados.email)) {
    marcarErro('email', 'Informe um e-mail válido.');
    ok = false;
  }
  if (!dados.municipio) {
    marcarErro('municipio', 'Selecione o município de atuação.');
    ok = false;
  }
  if (!arquivo) {
    marcarErro('documento_oab', 'Anexe a carteira da OAB (imagem ou PDF).');
    ok = false;
  } else if (arquivo.size > 10 * 1024 * 1024) {
    marcarErro('documento_oab', 'Arquivo maior que 10 MB.');
    ok = false;
  }
  if (!dados.consentimento_lgpd) {
    marcarErro('consentimento_lgpd', 'É necessário aceitar o tratamento de dados para prosseguir.');
    ok = false;
  }

  return ok;
}

function extensaoDe(nomeArquivo) {
  const partes = nomeArquivo.split('.');
  return partes.length > 1 ? partes.pop().toLowerCase() : 'bin';
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limparErros();

  const fd = new FormData(form);
  const dados = {
    nome_completo: fd.get('nome_completo')?.toString().trim() || '',
    cpf: fd.get('cpf')?.toString() || '',
    oab_numero: fd.get('oab_numero')?.toString().trim() || '',
    oab_seccional: (fd.get('oab_seccional')?.toString().trim() || 'PB').toUpperCase(),
    telefone: fd.get('telefone')?.toString() || '',
    email: fd.get('email')?.toString().trim().toLowerCase() || '',
    municipio: fd.get('municipio')?.toString() || '',
    consentimento_lgpd: fd.get('consentimento_lgpd') === 'on',
  };
  const arquivo = docInput.files[0];

  if (!validar(dados, arquivo)) {
    mensagem.className = 'mensagem erro';
    mensagem.textContent = 'Corrija os campos destacados antes de enviar.';
    mensagem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando…';

  try {
    const caminho = `pendentes/${crypto.randomUUID()}.${extensaoDe(arquivo.name)}`;
    const { error: erroUpload } = await supabase.storage
      .from('oab-documentos')
      .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });

    if (erroUpload) throw erroUpload;

    const municipiosApoio = Array.from(document.querySelectorAll('.select-municipio-apoio'))
      .map((sel) => sel.value)
      .filter((valor, indice, lista) => valor && valor !== dados.municipio && lista.indexOf(valor) === indice);

    const { error: erroInsert } = await supabase.from('advogados').insert({
      nome_completo: dados.nome_completo,
      cpf: dados.cpf.replace(/\D/g, ''),
      oab_numero: dados.oab_numero,
      oab_seccional: dados.oab_seccional,
      telefone: dados.telefone.replace(/\D/g, ''),
      email: dados.email,
      municipio: dados.municipio,
      municipios_apoio: municipiosApoio,
      documento_oab_path: caminho,
      consentimento_lgpd: true,
    });

    if (erroInsert) throw erroInsert;

    areaFormulario.hidden = true;
    telaSucesso.hidden = false;
    telaSucesso.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    let texto = 'Não foi possível enviar seu cadastro. Tente novamente em instantes.';
    if (err?.code === '23505' || /duplicate key|unique/i.test(err?.message || '')) {
      texto = 'Este CPF já está cadastrado. Se precisar corrigir algo, contate a Coordenação Jurídica.';
    }
    mensagem.className = 'mensagem erro';
    mensagem.textContent = texto;
    mensagem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar cadastro';
  }
});

carregarMunicipios();
