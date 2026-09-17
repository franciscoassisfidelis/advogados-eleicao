const XLSX = require('xlsx');

const CABECALHO = [
  'Nome completo',
  'CPF',
  'OAB',
  'Município principal',
  'Zona(s) eleitoral(is)',
  'Município(s) de apoio',
  'Telefone',
  'E-mail',
  'Status',
  'Cadastrado em',
];

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

/**
 * Gera o buffer .xlsx a partir das linhas da tabela `advogados`.
 * @param {Array<object>} advogados
 * @returns {Buffer}
 */
function gerarPlanilhaAdvogados(advogados) {
  const linhas = advogados.map((a) => ({
    'Nome completo': a.nome_completo,
    CPF: formatarCpf(a.cpf),
    OAB: `OAB/${a.oab_seccional} ${a.oab_numero}`,
    'Município principal': a.municipio,
    'Zona(s) eleitoral(is)': (a.zonas_eleitorais || []).length
      ? a.zonas_eleitorais.map((z) => `${z}ª`).join(', ')
      : 'A confirmar',
    'Município(s) de apoio': (a.municipios_apoio || []).join(', '),
    Telefone: formatarTelefone(a.telefone),
    'E-mail': a.email,
    Status: a.status === 'confirmado' ? 'Confirmado' : 'Pendente',
    'Cadastrado em': new Date(a.created_at).toLocaleString('pt-BR'),
  }));

  const planilha = XLSX.utils.json_to_sheet(linhas, { header: CABECALHO });
  planilha['!cols'] = [
    { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 26 }, { wch: 18 },
    { wch: 30 }, { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 18 },
  ];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, 'Advogados');

  return XLSX.write(livro, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { gerarPlanilhaAdvogados };
