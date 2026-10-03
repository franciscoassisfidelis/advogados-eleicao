const TAMANHO_PAGINA = 1000;

// A API do Supabase devolve no máximo 1.000 linhas por requisição; por isso
// buscamos em páginas até acabar. O desempate por id mantém a ordem estável.
async function buscarTodosAdvogados(supabaseAdmin) {
  const todos = [];
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await supabaseAdmin
      .from('advogados')
      .select('*')
      .order('municipio', { ascending: true })
      .order('nome_completo', { ascending: true })
      .order('id', { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1);

    if (error) throw error;
    todos.push(...data);
    if (data.length < TAMANHO_PAGINA) break;
  }
  return todos;
}

module.exports = { buscarTodosAdvogados };
