-- Fecha imediatamente a janela de importação. As imagens permanecem públicas
-- para leitura, mas novos uploads exigem credenciais administrativas.
drop policy if exists "Temporary PlacLux catalog upload" on storage.objects;
