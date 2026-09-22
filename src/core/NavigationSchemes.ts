// NavigationSchemes — decide o que um arraste de câmera faz (orbitar,
// panar ou nada) dado o esquema de navegação ativo, o botão do mouse que
// iniciou o arraste e se Shift está pressionado. Módulo puro (sem
// Three.js, sem estado, sem DOM) — a mesma decisão vale tanto pro
// ViewportController de verdade quanto pros testes, sem precisar montar
// canvas/câmera nenhum. Ver DEC (navegação: Fácil como padrão, Blender e
// Revit como opções) no Registro de Decisões Técnicas.
export type NavigationMode = 'facil' | 'blender' | 'revit';

export const NAVIGATION_MODES: NavigationMode[] = ['facil', 'blender', 'revit'];

export const NAVIGATION_MODE_LABELS: Record<NavigationMode, string> = {
  facil: 'Fácil',
  blender: 'Blender',
  revit: 'Revit',
};

export function isNavigationMode(value: unknown): value is NavigationMode {
  return value === 'facil' || value === 'blender' || value === 'revit';
}

// button segue a convenção do PointerEvent: 0 = esquerdo (sempre
// reservado pra seleção/edição, nunca câmera, em nenhum esquema), 1 =
// meio, 2 = direito.
export function resolveDragAction(mode: NavigationMode, button: number, shiftKey: boolean): 'orbit' | 'pan' | null {
  if (mode === 'blender') {
    // Igual ao comportamento de sempre do Esboce: botão do meio OU
    // direito arrasta; sem Shift gira, com Shift pana.
    if (button !== 1 && button !== 2) return null;
    return shiftKey ? 'pan' : 'orbit';
  }
  if (mode === 'revit') {
    // Só o botão do meio é câmera — o direito fica livre pro menu de
    // contexto (comportamento já existente, não deve ser interceptado
    // neste modo). Sem Shift pana, com Shift orbita (convenção real do
    // Revit num Vista 3D).
    if (button !== 1) return null;
    return shiftKey ? 'orbit' : 'pan';
  }
  // facil: só o botão direito é câmera, e só pana — nunca orbita por
  // arraste (orbitar é só pela bússola/NavGizmo, ver NavGizmo.ts). Shift
  // não muda nada aqui — não tem modificador escondido pra descobrir.
  return button === 2 ? 'pan' : null;
}
