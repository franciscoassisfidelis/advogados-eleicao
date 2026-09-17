const { createClient } = require('@supabase/supabase-js');

/**
 * Cliente Supabase com a service_role key — só deve ser usado dentro de
 * Netlify Functions (ambiente de servidor), NUNCA no navegador. Ignora
 * RLS por completo.
 */
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas nas variáveis de ambiente da função.');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Valida o token Bearer enviado pelo dashboard e confirma que corresponde
 * a um usuário autenticado do Supabase Auth (o único admin da coordenação
 * jurídica). Lança erro se ausente/ inválido.
 */
async function exigirAdmin(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    const err = new Error('Não autenticado.');
    err.statusCode = 401;
    throw err;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('Sessão inválida ou expirada.');
    err.statusCode = 401;
    throw err;
  }
  return { supabaseAdmin, user: data.user };
}

module.exports = { getSupabaseAdmin, exigirAdmin };
