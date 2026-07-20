#!/bin/bash
# Setup interativo do .env — cole cada valor e dê Enter.
# Enter em branco mantém o valor já salvo.
set -e
cd "$(dirname "$0")"
[ -f .env ] || cp .env.example .env

# valor atual, ignorando comentário inline e espaços
current() { grep "^$1=" .env | cut -d= -f2- | sed -E 's/[[:space:]]*#.*//; s/^[[:space:]]+|[[:space:]]+$//g'; }

set_var() {
  local name="$1" prompt="$2" secret="$3" cur val
  cur="$(current "$name")"
  if [ -n "$cur" ]; then
    prompt="$prompt [já preenchido — Enter mantém]"
  fi
  if [ "$secret" = "s" ]; then
    read -r -s -p "$prompt: " val; echo
  else
    read -r -p "$prompt: " val
  fi
  if [ -n "$val" ]; then
    sed -i '' "s|^$name=.*|$name=$val|" .env
    echo "  ✓ $name salvo"
  else
    echo "  – $name mantido"
  fi
}

echo "── Configuração do bot do MBA ──"
set_var TELEGRAM_BOT_TOKEN "Token do bot (@BotFather)" s
set_var ANTHROPIC_API_KEY  "Chave da API Anthropic" s
echo
echo "Chat IDs (se ainda não souber, deixe em branco — rode ./setup.sh de novo depois do /chatid):"
set_var CURATOR_CHAT_ID "Seu chat privado com o bot"
set_var GROUP_CHAT_ID   "Grupo dos alunos"
set_var MGMT_CHAT_ID    "Grupo da gestão"
echo
echo "Pronto. Para iniciar: npm start"
