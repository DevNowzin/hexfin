# HexFin

Aplicativo de finanças pessoais feito com Expo, React Native e TypeScript. Funciona localmente, sem cadastro. Valores e saldos ficam no aparelho.

## Funcionalidades

- Visão geral com saldo consolidado, contas, receitas e despesas.
- Fluxo de caixa dos últimos seis meses e gastos por categoria.
- Busca, filtros e navegação mensal no extrato, com a chave Conta | Cartão.
- Cadastro, edição e exclusão de transações, contas, contas fixas e empréstimos.
- Transferências, recorrências, pendências e observações.
- Assistentes calculados no dispositivo.
- Sugestão de categoria ao digitar a descrição: regras locais ou IA (chave própria ou servidor), sempre confirmada pelo usuário.
- Open Finance opcional pelo Pluggy (MeuPluggy), só leitura.
- PIN de 6 dígitos, temas claro, escuro e automático, e valores ocultos.
- Começa vazio: só mostra o que o usuário cadastrar.

## Instalar no Android

Baixe o APK da [última versão](https://github.com/DevNowzin/hexfin/releases/latest) e instale. Quando sair uma versão nova, o app avisa no Início; basta baixar e instalar por cima, sem perder os dados.

## Começar

Requisitos: Node.js `^22.23.4`, `^24.22.1` ou superior compatível e npm.

```sh
npm install
npx expo start
```

No terminal do Expo, pressione `a` para Android, `i` para iOS ou `w` para Web.

## Estrutura

```text
src/
  app/                    Rotas do Expo Router
  components/             Componentes visuais compartilhados
  features/finance/       Estado, formulários, modelos e cálculos
  features/ai/            Categorização e configuração da IA
  features/openfinance/   Open Finance pelo Pluggy
  features/security/      PIN e bloqueio
  features/update/        Aviso de versão nova pelo GitHub
  services/               Acesso à IA, ao Pluggy e ao GitHub
  theme/                  Cores, fontes e aparência
  utils/                  Formatação e utilitários
server/                   Backend opcional da IA (Node, sem build)
assets/                   Ícones e imagens do aplicativo
plugins/                  Assinatura do APK (chave fora do projeto)
scripts/                  Geração do APK e preview Web
```

## Verificações

```sh
npm run verify   # typecheck + testes + expo install --check + export:web
```

## Privacidade

Contas, transações e preferências ficam no armazenamento local do dispositivo ou navegador. Limpar os dados do aplicativo ou desinstalá-lo pode apagar esses registros.

A IA vem **desligada**. Ao ativá-la em **Perfil → Inteligência artificial**, com consentimento, só a descrição e o tipo da transação são enviados para sugerir uma categoria. A chave própria fica criptografada no aparelho (SecureStore); no modo servidor, a chave fica só no backend. Os cálculos financeiros continuam determinísticos.

O Open Finance é opcional e só lê dados; o app nunca faz pagamentos nem transferências. Para saber se há versão nova, o app só consulta a página pública de versões no GitHub, sem enviar nada.
