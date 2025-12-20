#!/bin/bash
# Helper script to simulate cart scanning items into a receipt
# Usage: ./scripts/test-receipt-scan.sh <receiptId> <itemName> <price> [quantity] [category]

RECEIPT_ID=$1
ITEM_NAME=$2
PRICE=$3
QUANTITY=${4:-1}
CATEGORY=${5:-""}

if [ -z "$RECEIPT_ID" ] || [ -z "$ITEM_NAME" ] || [ -z "$PRICE" ]; then
  echo "Usage: $0 <receiptId> <itemName> <price> [quantity] [category]"
  echo "Example: $0 rec_123 'Milk' 3.99 1 'Dairy'"
  exit 1
fi

curl -X POST "http://localhost:3000/api/receipts/$RECEIPT_ID/items" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$ITEM_NAME\",
    \"price\": $PRICE,
    \"quantity\": $QUANTITY,
    \"category\": \"$CATEGORY\"
  }" | jq .

echo ""

