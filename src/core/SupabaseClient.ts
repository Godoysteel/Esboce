// Cliente Supabase — salvar/carregar/compartilhar projeto (ver ATLAS
// e Registro de Decisões: MVP precisa de "salvar projeto" e
// "compartilhar por link", nenhum dos dois existia até aqui).
//
// A chave abaixo é a "publishable" (equivalente à antiga "anon
// public") — ela é FEITA pra ficar exposta no navegador, não é
// segredo. Quem protege os dados é a Row Level Security (RLS) da
// tabela `projects` no banco (ver supabase-schema.sql), não o
// sigilo da chave. NUNCA coloque a chave "secret"/"service_role"
// aqui — essa sim dá acesso total ao banco sem restrição.
//
// Nesta rodada (versão de testes, sem login): qualquer um com o link
// do projeto consegue ver e editar — modelo "Google Docs, qualquer
// um com o link". Login/permissão por dono é trabalho futuro (ver
// Identity/AccessPolicy no Domínio v2.1).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dugcwndtflcjajffxjko.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_32BTfCDesA9WyH9Ltm0-zw_MKttNAfO';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export interface ProjectRow {
  id: string;
  data: unknown;
  created_at: string;
  updated_at: string;
}

// Id curto (8 chars, alfanumérico) pra o link ficar legível — não
// precisa da unicidade forte de um UUID: colisão é praticamente
// impossível na escala de uma versão de testes, e o schema tem
// `id text primary key` (o insert falha alto e claro se colidir, não
// silenciosamente).
function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) id += chars[bytes[i]! % chars.length];
  return id;
}

// Salva um projeto NOVO (gera um id novo) e devolve o id — usado no
// primeiro "Salvar" de uma sessão. Tenta de novo em caso raro de
// colisão de id (insert falha por violar a primary key).
export async function createSharedProject(projectData: unknown): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = generateShortId();
    const { error } = await supabase.from('projects').insert({ id, data: projectData });
    if (!error) return id;
    // 23505 = unique_violation no Postgres — só nesse caso vale tentar
    // de novo com outro id; qualquer outro erro (rede, RLS, etc.)
    // propaga na hora.
    if ((error as any).code !== '23505') throw error;
  }
  throw new Error('Não foi possível gerar um id único para o projeto após 3 tentativas.');
}

// Atualiza um projeto que já tem id (ex.: já foi salvo/compartilhado
// nesta sessão, ou foi carregado de um link) — sobrescreve o data.
export async function updateSharedProject(id: string, projectData: unknown): Promise<void> {
  const { error } = await supabase.from('projects').update({ data: projectData }).eq('id', id);
  if (error) throw error;
}

// Carrega um projeto pelo id (usado ao abrir um link ?p=<id>).
// Devolve null se o id não existir (link inválido/expirado).
export async function loadSharedProject(id: string): Promise<unknown | null> {
  const { data, error } = await supabase.from('projects').select('data').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? (data as { data: unknown }).data : null;
}