const { exigirAdmin } = require('./_lib/supabaseAdmin');
const { gerarPlanilhaAdvogados } = require('./_lib/gerarPlanilha');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Método não permitido' };
  }

  try {
    const { supabaseAdmin } = await exigirAdmin(event);

    const { data: advogados, error } = await supabaseAdmin
      .from('advogados')
      .select('*')
      .order('municipio', { ascending: true })
      .order('nome_completo', { ascending: true });

    if (error) throw error;

    const buffer = gerarPlanilhaAdvogados(advogados || []);
    const dataHoje = new Date().toISOString().slice(0, 10);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="advogados-dia-da-eleicao-${dataHoje}.xlsx"`,
        'Cache-Control': 'no-store',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('export-xlsx:', err);
    return {
      statusCode: err.statusCode || 500,
      body: err.statusCode === 401 ? 'Não autorizado.' : 'Erro ao gerar a planilha.',
    };
  }
};
