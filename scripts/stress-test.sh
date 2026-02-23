#!/bin/bash
# SoulPrint Stress Test Script
# Usage: ./stress-test.sh [light|medium|heavy]

MODE=${1:-light}
API_URL="https://soulprintengine.ai"

echo "🔥 SoulPrint Stress Test - Mode: $MODE"
echo "=========================================="

# Test 1: Health Check
echo -e "\n📍 Test 1: Health Check"
curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" "$API_URL/"

# Test 2: Concurrent Chat Requests
echo -e "\n📍 Test 2: Concurrent Chat Requests"

case $MODE in
  light)  CONCURRENT=5;  REQUESTS=10 ;;
  medium) CONCURRENT=20; REQUESTS=50 ;;
  heavy)  CONCURRENT=50; REQUESTS=100 ;;
esac

echo "Sending $REQUESTS requests ($CONCURRENT concurrent)..."

stress_chat() {
  local i=$1
  local start=$(date +%s.%N)
  local status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_URL/api/chat" \
    -H "Content-Type: application/json" \
    -H "Authorization: Email test$i@stresstest.com" \
    -d '{"message":"Hello, this is stress test message '$i'"}')
  local end=$(date +%s.%N)
  local duration=$(echo "$end - $start" | bc)
  echo "  Request $i: $status (${duration}s)"
}

export -f stress_chat
export API_URL

seq 1 $REQUESTS | xargs -P $CONCURRENT -I {} bash -c 'stress_chat {}'

# Test 3: Telegram Webhook Simulation
echo -e "\n📍 Test 3: Telegram Webhook Simulation"
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "Webhook $i: %{http_code}\n" \
    -X POST "$API_URL/telegram/webhook/soulprint2bot" \
    -H "Content-Type: application/json" \
    -d '{
      "update_id": '$((1000000 + i))',
      "message": {
        "message_id": '$i',
        "from": {"id": 12345, "is_bot": false, "first_name": "StressTest"},
        "chat": {"id": 12345, "type": "private"},
        "date": '$(date +%s)',
        "text": "Stress test message '$i'"
      }
    }'
done

# Test 4: Response Time Stats
echo -e "\n📍 Test 4: API Response Times (5 sequential)"
total=0
for i in 1 2 3 4 5; do
  time=$(curl -s -o /dev/null -w "%{time_total}" \
    -X POST "$API_URL/api/chat" \
    -H "Content-Type: application/json" \
    -H "Authorization: Email drew@archeforge.com" \
    -d '{"message":"Quick test"}')
  echo "  Request $i: ${time}s"
  total=$(echo "$total + $time" | bc)
done
avg=$(echo "scale=3; $total / 5" | bc)
echo "  Average: ${avg}s"

# Summary
echo -e "\n=========================================="
echo "✅ Stress Test Complete"
echo ""
echo "Next steps:"
echo "  - Check Cloudflare dashboard for errors"
echo "  - Review API costs in Anthropic console"
echo "  - Check Worker CPU time in Cloudflare"
