import { supabase } from '../../js/supabaseClient.js';

const form = document.getElementById('form-login');

// Tudo isto só deve rodar na tela de login (form-login só existe em
// index.html). O dashboard também importa este módulo (só para usar
// exigirSessao abaixo) — sem esse guard, o "se já logado, vai pro
// dashboard" dispararia dentro do próprio dashboard.html e causaria um
// loop infinito de redirecionamento/reload.
if (form) {
  const erroBox = document.getElementById('login-erro');
  const btn = document.getElementById('btn-login');

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.replace('dashboard.html');
  } else {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      erroBox.classList.remove('ativo');
      btn.disabled = true;
      btn.textContent = 'Entrando…';

      const email = document.getElementById('email').value.trim();
      const senha = document.getElementById('senha').value;

      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

      if (error) {
        erroBox.textContent = 'E-mail ou senha inválidos.';
        erroBox.classList.add('ativo');
        btn.disabled = false;
        btn.textContent = 'Entrar';
        return;
      }

      window.location.replace('dashboard.html');
    });
  }
}

// Utilitário de proteção de rota, usado pelo dashboard.
export async function exigirSessao() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace('index.html');
    return null;
  }
  return session;
}
