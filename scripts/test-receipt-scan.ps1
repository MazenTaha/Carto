# PowerShell script to simulate cart scanning items into a receipt
# Usage: .\scripts\test-receipt-scan.ps1 -ReceiptId <id> -ItemName <name> -Price <price> [-Quantity <qty>] [-Category <cat>]

param(
    [Parameter(Mandatory=$true)]
    [string]$ReceiptId,
    
    [Parameter(Mandatory=$true)]
    [string]$ItemName,
    
    [Parameter(Mandatory=$true)]
    [double]$Price,
    
    [Parameter(Mandatory=$false)]
    [int]$Quantity = 1,
    
    [Parameter(Mandatory=$false)]
    [string]$Category = ""
)

$body = @{
    name = $ItemName
    price = $Price
    quantity = $Quantity
    category = $Category
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/receipts/$ReceiptId/items" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

$response | ConvertTo-Json -Depth 10

