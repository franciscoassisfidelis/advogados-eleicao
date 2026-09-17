// Função OPCIONAL: gera a planilha e grava uma cópia direto numa pasta do
// Google Drive da coordenação, usando uma conta de serviço do Google.
//
// Configuração necessária (variáveis de ambiente do Netlify):
//   GOOGLE_SERVICE_ACCOUNT_JSON  — conteúdo do JSON da conta de serviço
//                                  (Google Cloud Console > IAM > Contas de
//                                  serviço > Chaves), colado como string.
//   GOOGLE_DRIVE_FOLDER_ID       — ID da pasta de destino no Drive
//                                  (a pasta deve ser COMPARTILHADA com o
//                                  e-mail da conta de serviço, com permissão
//                                  de Editor).
//
// Se essas variáveis não estiverem definidas, a função retorna 501 e o
// dashboard trata isso como "integração não configurada" — a exportação
// direta em Excel continua funcionando normalmente sem essa etapa.

const { google } = require('googleapis');
const { Readable } = require('stream');
const { exigirAdmin } = require('./_lib/supabaseAdmin');
const { gerarPlanilhaAdvogados } = require('./_lib/gerarPlanilha');

async function getDriveClient() {
  const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credsJson) return null;

  const credentials = JSON.parse(credsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método não permitido' };
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  try {
    const { supabaseAdmin } = await exigirAdmin(event);

    const drive = await getDriveClient();
    if (!drive || !folderId) {
      return {
        statusCode: 501,
        body: JSON.stringify({
          configurado: false,
          mensagem: 'Integração com Google Drive não configurada (GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_DRIVE_FOLDER_ID ausentes).',
        }),
      };
    }

    const { data: advogados, error } = await supabaseAdmin
      .from('advogados')
      .select('*')
      .order('municipio', { ascending: true })
      .order('nome_completo', { ascending: true });

    if (error) throw error;

    const buffer = gerarPlanilhaAdvogados(advogados || []);
    const dataHoje = new Date().toISOString().slice(0, 10);
    const nomeArquivo = `advogados-dia-da-eleicao-${dataHoje}.xlsx`;

    // Evita acumular uma cópia nova a cada clique no mesmo dia: se já
    // existir um arquivo com o mesmo nome na pasta, atualiza seu conteúdo.
    const busca = await drive.files.list({
      q: `name = '${nomeArquivo.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const media = {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Readable.from(buffer),
    };

    let arquivo;
    if (busca.data.files && busca.data.files.length > 0) {
      const fileId = busca.data.files[0].id;
      arquivo = await drive.files.update({ fileId, media, fields: 'id, webViewLink' });
    } else {
      arquivo = await drive.files.create({
        requestBody: { name: nomeArquivo, parents: [folderId] },
        media,
        fields: 'id, webViewLink',
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        configurado: true,
        arquivoId: arquivo.data.id,
        link: arquivo.data.webViewLink,
      }),
    };
  } catch (err) {
    console.error('sync-drive:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ configurado: true, mensagem: 'Erro ao gravar no Google Drive.' }),
    };
  }
};
