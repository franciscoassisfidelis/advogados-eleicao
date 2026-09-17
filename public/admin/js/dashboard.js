import { supabase } from '../../js/supabaseClient.js';
import { exigirSessao } from './auth.js';

const session = await exigirSessao();
if (!session) {
  // exigirSessao já redirecionou para o login.
  throw new Error('sem sessão');
}

document.getElementById('usuario-logado').textContent = session.user.email;

const tabelaCorpo = document.getElementById('tabela-corpo');
const filtroBusca = document.getElementById('filtro-busca');
const filtroMunicipio = document.getElementById('filtro-municipio');
const filtroZona = document.getElementById('filtro-zona');
const filtroStatus = document.getElementById('filtro-status');
const toast = document.getElementById('toast');
const btnExportar = document.getElementById('btn-exportar');
const btnSalvarDrive = document.getElementById('btn-salvar-drive');
const btnSenha = document.getElementById('btn-senha');
const btnSair = document.getElementById('btn-sair');

let registros = [];

function mostrarToast(texto, tipo = 'ok') {
  toast.textContent = texto;
  toast.className = `toast ativo${tipo === 'erro' ? ' erro' : ''}`;
  setTimeout(() => toast.classList.remove('ativo'), 3200);
}

function formatarCpf(cpf) {
  if (!cpf) return '';
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatarTelefone(tel) {
  if (!tel) return '';
  if (tel.length === 11) return tel.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (tel.length === 10) return tel.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return tel;
}

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

async function abrirDocumento(path) {
  const { data, error } = await supabase.storage
    .from('oab-documentos')
    .createSignedUrl(path, 120);

  if (error || !data?.signedUrl) {
    mostrarToast('Não foi possível abrir o documento.', 'erro');
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener');
}

async function alterarStatus(id, novoStatus, selectEl) {
  const anterior = selectEl.dataset.valorAtual;
  const { error } = await supabase.from('advogados').update({ status: novoStatus }).eq('id', id);
  if (error) {
    mostrarToast('Erro ao atualizar status.', 'erro');
    selectEl.value = anterior;
    return;
  }
  selectEl.dataset.valorAtual = novoStatus;
  const reg = registros.find((r) => r.id === id);
  if (reg) reg.status = novoStatus;
  atualizarResumo();
  mostrarToast('Status atualizado.');
}

function linhaHtml(reg) {
  const zonas = (reg.zonas_eleitorais || []).length
    ? reg.zonas_eleitorais.map((z) => `${z}ª`).join(', ')
    : '<span style="color:var(--cor-texto-suave)">a confirmar</span>';

  return `
    <tr data-id="${reg.id}">
      <td>${escapeHtml(reg.nome_completo)}</td>
      <td>${formatarCpf(reg.cpf)}</td>
      <td>OAB/${escapeHtml(reg.oab_seccional)} ${escapeHtml(reg.oab_numero)}</td>
      <td>${escapeHtml(reg.municipio)}</td>
      <td>${zonas}</td>
      <td>${formatarTelefone(reg.telefone)}</td>
      <td>${escapeHtml(reg.email)}</td>
      <td><a href="#" class="link-doc" data-path="${escapeHtml(reg.documento_oab_path)}">Ver OAB</a></td>
      <td>
        <select class="status-select" data-id="${reg.id}" data-valor-atual="${reg.status}">
          <option value="pendente" ${reg.status === 'pendente' ? 'selected' : ''}>Pendente</option>
          <option value="confirmado" ${reg.status === 'confirmado' ? 'selected' : ''}>Confirmado</option>
        </select>
      </td>
      <td>${formatarData(reg.created_at)}</td>
    </tr>
  `;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function aplicarFiltros() {
  const busca = filtroBusca.value.trim().toLowerCase();
  const municipio = filtroMunicipio.value;
  const zona = filtroZona.value.trim().replace(/[^\d]/g, '');
  const status = filtroStatus.value;

  return registros.filter((r) => {
    if (municipio && r.municipio !== municipio) return false;
    if (status && r.status !== status) return false;
    if (zona && !(r.zonas_eleitorais || []).includes(zona)) return false;
    if (busca) {
      const alvo = `${r.nome_completo} ${r.cpf} ${r.oab_numero}`.toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

function renderizarTabela() {
  const filtrados = aplicarFiltros();
  if (filtrados.length === 0) {
    tabelaCorpo.innerHTML = '<tr><td colspan="10" class="estado-vazio">Nenhum registro encontrado com os filtros atuais.</td></tr>';
    return;
  }
  tabelaCorpo.innerHTML = filtrados.map(linhaHtml).join('');
}

function atualizarResumo() {
  document.getElementById('resumo-total').textContent = registros.length;
  document.getElementById('resumo-pendente').textContent = registros.filter((r) => r.status === 'pendente').length;
  document.getElementById('resumo-confirmado').textContent = registros.filter((r) => r.status === 'confirmado').length;
  document.getElementById('resumo-municipios').textContent = new Set(registros.map((r) => r.municipio)).size;
}

async function carregarMunicipiosFiltro() {
  const { data } = await supabase.from('municipios_zonas').select('municipio').order('municipio');
  for (const row of data || []) {
    const opt = document.createElement('option');
    opt.value = row.municipio;
    opt.textContent = row.municipio;
    filtroMunicipio.appendChild(opt);
  }
}

async function carregarRegistros() {
  const { data, error } = await supabase
    .from('advogados')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    tabelaCorpo.innerHTML = `<tr><td colspan="10" class="estado-vazio">Erro ao carregar dados: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  registros = data;
  atualizarResumo();
  renderizarTabela();
}

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------
[filtroBusca, filtroMunicipio, filtroZona, filtroStatus].forEach((el) => {
  el.addEventListener('input', renderizarTabela);
  el.addEventListener('change', renderizarTabela);
});

tabelaCorpo.addEventListener('click', (ev) => {
  const link = ev.target.closest('.link-doc');
  if (link) {
    ev.preventDefault();
    abrirDocumento(link.dataset.path);
  }
});

tabelaCorpo.addEventListener('change', (ev) => {
  const select = ev.target.closest('.status-select');
  if (select) {
    alterarStatus(select.dataset.id, select.value, select);
  }
});

btnSenha.addEventListener('click', async () => {
  const novaSenha = window.prompt('Digite a nova senha de acesso ao dashboard (mínimo 6 caracteres):');
  if (!novaSenha) return;
  if (novaSenha.length < 6) {
    mostrarToast('A senha precisa ter pelo menos 6 caracteres.', 'erro');
    return;
  }
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) {
    mostrarToast('Erro ao definir senha: ' + error.message, 'erro');
    return;
  }
  mostrarToast('Senha definida! Use-a para entrar da próxima vez.');
});

btnSair.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.replace('index.html');
});

btnExportar.addEventListener('click', async () => {
  btnExportar.disabled = true;
  btnExportar.textContent = 'Gerando…';
  try {
    const { data: { session: sessaoAtual } } = await supabase.auth.getSession();
    const resp = await fetch('/.netlify/functions/export-xlsx', {
      headers: { Authorization: `Bearer ${sessaoAtual.access_token}` },
    });
    if (!resp.ok) {
      const texto = await resp.text().catch(() => '');
      throw new Error(texto || `Erro ${resp.status}`);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advogados-dia-da-eleicao-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    mostrarToast('Planilha exportada.');
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao exportar planilha.', 'erro');
  } finally {
    btnExportar.disabled = false;
    btnExportar.textContent = '⬇ Exportar Excel';
  }
});

btnSalvarDrive.addEventListener('click', async () => {
  btnSalvarDrive.disabled = true;
  btnSalvarDrive.textContent = 'Salvando…';
  try {
    const { data: { session: sessaoAtual } } = await supabase.auth.getSession();
    const resp = await fetch('/.netlify/functions/sync-drive', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessaoAtual.access_token}` },
    });
    const corpo = await resp.json().catch(() => ({}));

    if (resp.status === 501 || corpo.configurado === false) {
      mostrarToast('Integração com o Google Drive não está configurada.', 'erro');
      return;
    }
    if (!resp.ok) throw new Error(corpo.mensagem || 'Erro ao salvar no Drive');

    mostrarToast('Planilha salva no Google Drive da coordenação.');
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao salvar no Google Drive.', 'erro');
  } finally {
    btnSalvarDrive.disabled = false;
    btnSalvarDrive.textContent = '☁ Salvar no Drive';
  }
});

await Promise.all([carregarMunicipiosFiltro(), carregarRegistros()]);
