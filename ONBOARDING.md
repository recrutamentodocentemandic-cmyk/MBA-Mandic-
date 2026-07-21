# Onboarding — MBA-Mandic- (Hermes — MBA)

Bem-vindo(a) ao repositório do **Hermes — MBA**, o agente de IA que apoia a operação do MBA em Gestão Educacional em Saúde com IA (São Leopoldo Mandic, turma 2026). Ele vive no Telegram (@MBAMandicbot): conversa com o time no grupo de gestão, observa o grupo dos alunos e propõe respostas que o time aprova ou descarta.

## O que você precisa (uma vez só)

1. **Conta no GitHub** com convite aceito para este repositório (o Rodrigo envia o convite);
2. **Git** e **Node.js 22+** instalados;
3. **Claude Code** instalado e logado (claude.com/claude-code).

## Primeiros passos

```bash
git clone https://github.com/recrutamentodocentemandic-cmyk/MBA-Mandic-.git
cd MBA-Mandic-
npm install
npm run typecheck   # deve terminar sem erros
claude              # abre o Claude Code dentro do projeto
```

O Claude Code lê automaticamente o `CLAUDE.md` do projeto e já entende o mapa do código, as regras e os limites. Pode pedir a ele, em português, coisas como: "explique como funciona a curadoria das respostas aos alunos" ou "ajuste o texto da IDENTIDADE do agente".

## O que você pode fazer daqui

- **Editar o cérebro do agente** (`hermes/*.md`): identidade, conduta, missão e o registro de pessoas. É a forma mais direta de mudar como ele se comporta;
- **Melhorar o código** (`src/`): fluxos do Telegram, lembretes, engajamento;
- **Ajustar o calendário** (`config/calendar.json`): datas oficiais dos módulos.

Commit e push normais. **O deploy para produção (VPS) é centralizado com o Rodrigo** — seu push não altera o bot no ar até ele publicar.

## O que NÃO fazer

- **Não rodar `npm start`**: o bot de produção já roda no servidor; uma segunda instância com o mesmo token derruba a entrega de mensagens do Telegram;
- **Não criar `.env` nem pedir/commitar tokens ou chaves** — segredos não vivem neste repo;
- **Não commitar material do curso ou documentos internos** (`content/` e `knowledge/` ficam fora do git de propósito);
- Dado individual de aluno é sensível: fica no banco, uso interno da gestão.

## Dúvidas

Pergunte ao próprio Claude Code dentro do projeto — ou ao Rodrigo. No Telegram, o agente responde no grupo de gestão quando chamado por "Hermes".
