#!/bin/bash
# Grava e valida APENAS o token do Telegram. Entrada visível de propósito.
set -e
cd "$(dirname "$0")"
[ -f .env ] || cp .env.example .env

echo ""
echo "Cole o token do BotFather e aperte Enter."
echo "(você vai VER o texto colado — confira se apareceu uma vez só)"
echo ""
read -r -p "Token: " TOKEN

# remove espaços acidentais
TOKEN=$(echo "$TOKEN" | tr -d '[:space:]')

if [ -z "$TOKEN" ]; then
  echo "Nada foi colado. Rode ./token.sh de novo."
  exit 1
fi

BOTNAME=$(curl -s "https://api.telegram.org/bot${TOKEN}/getMe" \
  | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')

if [ -n "$BOTNAME" ]; then
  sed -i '' "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TOKEN|" .env
  echo ""
  echo "✅ Deu certo! Token salvo. Seu bot é: @$BOTNAME"
else
  echo ""
  echo "❌ Esse token não foi aceito pelo Telegram."
  echo "   Copie de novo no BotFather (toque no código para copiar) e rode ./token.sh outra vez."
  exit 1
fi
