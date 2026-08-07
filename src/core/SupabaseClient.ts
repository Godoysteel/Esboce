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
// colisão de id (insert falha por violar a primary key). userId é
// obrigatório desde que login passou a existir — a RLS de projects
// exige auth.uid() = user_id no insert, então sem isso o Supabase
// rejeita a gravação.
export async function createSharedProject(projectData: unknown, userId: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = generateShortId();
    const { error } = await supabase.from('projects').insert({ id, data: projectData, user_id: userId });
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
// Devolve `true` se de fato atualizou uma linha. Importante: a RLS
// (auth.uid() = user_id) filtra silenciosamente — se quem chamou não é
// o dono do projeto (ex.: abriu o link de outra pessoa), o Postgrest
// não dá erro, só não afeta nenhuma linha. Sem checar isso, o app
// mostraria "salvo" sem ter salvo nada de verdade.
export async function updateSharedProject(id: string, projectData: unknown): Promise<boolean> {
  const { data, error } = await supabase.from('projects').update({ data: projectData }).eq('id', id).select('id');
  if (error) throw error;
  return !!(data && data.length);
}

// Carrega um projeto pelo id (usado ao abrir um link ?p=<id>).
// Devolve null se o id não existir (link inválido/expirado).
export async function loadSharedProject(id: string): Promise<unknown | null> {
  const { data, error } = await supabase.from('projects').select('data').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? (data as { data: unknown }).data : null;
}

// ---- Cadastro / login ----
//
// Login passou a ser obrigatório pra salvar/editar um projeto — o
// cadastro (nome, telefone, endereço) é o próprio ativo de negócio da
// plataforma, não uma formalidade. Ver/abrir um link compartilhado
// continua público (não exige login), só criar/editar exige.

export interface ProfileFields {
  nome: string;
  telefone: string;
  cep?: string;
  estado?: string;
  cidade?: string;
  bairro?: string;
  rua?: string;
  numero?: string;
}

// Devolve o usuário logado agora (null se ninguém logado). Útil pra
// checar "já tem sessão?" antes de abrir o modal de cadastro/login.
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

// Cadastro novo: cria a conta (auth) e, na sequência, a linha de
// perfil (dados de negócio). Se o projeto Supabase exigir confirmação
// de e-mail (padrão de fábrica), `session` volta null aqui — nesse
// caso ainda NÃO dá pra salvar (RLS exige auth.uid()), então quem
// chamar isso precisa avisar o usuário pra confirmar o e-mail antes de
// tentar salvar de novo.
export async function signUpWithProfile(email: string, password: string, profile: ProfileFields): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Cadastro não retornou um usuário.');

  // Sem sessão ativa ainda (confirmação de e-mail pendente) — a RLS de
  // profiles também exige auth.uid(), então o insert do perfil só
  // funciona com sessão. Se não tem sessão, avisa e para por aqui; o
  // perfil é criado depois, no primeiro login pós-confirmação (ver
  // ensureProfileExists, chamado no fluxo de login).
  if (!data.session) return { needsEmailConfirmation: true };

  const { error: profileError } = await supabase.from('profiles').insert({ id: data.user.id, ...profile });
  if (profileError) throw profileError;
  return { needsEmailConfirmation: false };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Garante que, ao logar, o usuário tem uma linha em profiles — cobre o
// caso de cadastro com confirmação de e-mail pendente (a linha não foi
// criada no signUp original, porque não havia sessão ainda pra
// autorizar o insert). Se já existe, não faz nada.
export async function ensureProfileExists(userId: string, profile: ProfileFields): Promise<void> {
  const { data } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (data) return;
  const { error } = await supabase.from('profiles').insert({ id: userId, ...profile });
  if (error) throw error;
}

// Lista os projetos do usuário logado, mais recente primeiro — a
// resposta de verdade pra "e quando o usuário quiser carregar um
// projeto salvo?" agora que projetos têm dono. Sem isso, só dava pra
// achar um projeto salvo tendo o link guardado.
export interface OwnedProjectSummary { id: string; updated_at: string; created_at: string; }
export async function listMyProjects(userId: string): Promise<OwnedProjectSummary[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OwnedProjectSummary[];
}