# Lago

Experiência sensorial de um lago interativo, renderizada localmente com React, TypeScript e WebGL2. Ondas, carpas, vegetação, chuva, vento, reflexos e áudio procedural funcionam sem serviços externos.

## Requisitos e execução

- Node.js 20+
- Navegador moderno com WebGL2 e framebuffer de ponto flutuante

```bash
npm install
npm run dev
```

## Controles

- Ponteiro/toque: interage conforme o modo selecionado.
- `Espaço`: onda central.
- `P`: pedra. `A`: alimento. `V`: vento. `R`: acalmar. `M`: áudio.

Os controles desaparecem após alguns segundos de inatividade. O Modo Zen oculta toda a interface.

## Qualidade e arquitetura

`Auto` observa o tempo dos frames e alterna gradualmente entre Economy, Balanced e Immersive. Os três perfis continuam disponíveis como override manual.

- `src/engine`: coordenadas normalizadas e timestep fixo.
- `src/performance`: qualidade adaptativa com histerese.
- `src/webgl`: heightfield, forças GPU, micro-ondas e composição WebGL2.
- `src/simulation`: carpas e vegetação com movimento baseado em tempo.
- `src/components`: adaptadores React, controles e acessibilidade.
- `src/audio`: áudio procedural e lifecycle de visibilidade.

## Verificação

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

O desenho e o plano da modernização ficam em `docs/superpowers/`.
