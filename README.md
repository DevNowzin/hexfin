# HexFin

Aplicativo de finanças pessoais feito com Expo, React Native e TypeScript. Funciona localmente, sem cadastro. Valores e saldos nunca saem do aparelho.

## Funcionalidades

- Visão geral com saldo consolidado, contas, receitas e despesas.
- Fluxo de caixa dos últimos seis meses e gastos por categoria.
- Busca, filtros e navegação mensal no extrato.
- Cadastro, edição e exclusão de transações e contas.
- Transferências, recorrências, pendências e observações.
- Insights calculados no dispositivo.
- Sugestão de categoria ao digitar a descrição: regras locais ou IA (chave própria ou servidor), sempre confirmada pelo usuário.
- Temas claro, escuro e automático.
- Valores ocultos para privacidade.
- Persistência local e dados de demonstração restauráveis.

## Começar

Requisitos: Node.js `^22.23.4`, `^24.22.1` ou superior compatível e npm.

```sh
npm install
npx expo start
```

No terminal do Expo, pressione `a` para Android, `i` para iOS ou `w` para Web. Todos os comandos estão documentados em [`docs/COMANDOS.md`](docs/COMANDOS.md).

## Documentação

- [**Comandos**](docs/COMANDOS.md): instalação, execução, testes, exportação e manutenção.
- [**Como o projeto funciona**](docs/COMO_FUNCIONA.md): arquitetura, telas, estado, dados e persistência.
- [**Plano de API de IA**](docs/IA_API.md): quais telas terão IA, contratos, backend, privacidade e etapas de implementação.

## Estrutura

```text
src/
  app/                    Rotas do Expo Router
  components/             Componentes visuais compartilhados
  features/finance/       Estado, formulários, modelos e cálculos
  features/ai/            Categorização, configuração e chamada da IA
  services/ai.ts          Único ponto de acesso à IA no app
  theme/                  Cores, fontes e aparência
  utils/                  Formatação e utilitários
server/                   Backend opcional da IA (Node, sem build)
assets/                   Ícones próprios do aplicativo
docs/                     Documentação e capturas de verificação
scripts/                  Scripts de manutenção e preview
reference/                Materiais originais separados; nunca entram no build
```

As fontes Geist são consumidas pelo pacote npm `@expo-google-fonts/geist`, não pelos arquivos de referência.

## Verificações

```sh
npm run verify   # check + export:web
```

## Privacidade

O HexFin não se conecta a bancos. Contas, transações e preferências ficam no armazenamento local do dispositivo ou navegador. Limpar os dados do aplicativo ou desinstalá-lo pode apagar esses registros.

A IA vem **desligada**. Ao ativá-la em **Perfil → Inteligência artificial**, com consentimento, só a descrição e o tipo da transação são enviados para sugerir uma categoria. A chave própria fica criptografada no aparelho (SecureStore); no modo servidor, a chave fica só no backend. Os cálculos financeiros continuam determinísticos. Detalhes em [`docs/IA_API.md`](docs/IA_API.md).
