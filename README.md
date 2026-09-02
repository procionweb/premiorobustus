# Jogos Procion

Este repositorio contem somente os dois jogos ativos: Premio Robust us e Bhaskar.

## Premio Robust us

- Aplicacao principal web: `/`
- Jogo da cesta: `/jogo-cesta`
- Versao offline para tablet: `/tablet-offline`
- Relatorio offline: `/admin/relatorio-offline`
- Codigo principal: `src/pages/JogoCesta.tsx`, `src/components/` e `src/pages/tablet-offline/`
- Assets: `public/robustus-catch-game/`, `public/offline-banners/` e `src/assets/`

## Bhaskar

- Jogo: `/bar-game`
- Administracao: `/bar-game/admin`
- Codigo principal: `src/pages/BarGame.tsx`
- Roleta: `src/components/BhaskarPrizeRoulette.tsx`
- Banco offline: `src/lib/barGameDb.ts`
- Assets: `public/bar-game/`

No Android, a rota inicial abre diretamente o Bhaskar. Na web, a rota inicial abre o Premio Robust us.

## Comandos

```bash
npm run dev
npm run build
npm run android:sync
npm run android:apk
```

O APK de desenvolvimento e gerado em `android/app/build/outputs/apk/debug/app-debug.apk`.
