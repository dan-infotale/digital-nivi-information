# Webhook Testing Guide

How to send a simulated WhatsApp message and get the bot reply back in the HTTP response — no DB inspection, no real WhatsApp delivery.

---

## 1. Get the webhook URL

In the admin UI: **Tenant → Connectors**. Each connector row shows its **Webhook** URL with a copy button.

Format: `<origin>/webhook/<connectorId>`
Example: `https://your-app.com/webhook/65f1a2b3c4d5e6f7a8b9c0d1`

For testing, append `/test`:
`https://your-app.com/webhook/65f1a2b3c4d5e6f7a8b9c0d1/test`

---

## 2. Request

`POST <webhook URL>/test` with `Content-Type: application/json`:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "field": "messages",
      "value": {
        "messages": [{
          "from": "972500000000",
          "id": "wamid.TEST_1",
          "timestamp": "1700000000",
          "type": "text",
          "text": { "body": "שלום" }
        }]
      }
    }]
  }]
}
```

Key fields:
- `from` — sender phone (conversation key).
- `id` — message id (used for dedup; must be unique per test).
- `type` — `"text"` for normal messages.
- `text.body` — the message content.

---

## 3. Response

Unlike the production webhook (which always returns `200` immediately), `/test` processes **synchronously** and returns the result inline:

```json
{
  "ok": true,
  "results": [{
    "from": "972500000000",
    "messageId": "wamid.TEST_1",
    "status": "ok",
    "botReply": "שעות הפעילות הן 9:00-17:00.",
    "outbound": ["שעות הפעילות הן 9:00-17:00."],
    "suppressed": false,
    "classifier": { "ran": true, "decision": "answer" }
  }]
}
```

### Result fields

| Field         | Meaning                                                                       |
|---------------|-------------------------------------------------------------------------------|
| `status`      | `ok` \| `greeting_suppressed` \| `pii_blocked` \| `duplicate` \| `new_session` \| `bot_error` \| `session_init_failed` |
| `botReply`    | The bot's raw reply (present when the bot was called, even if suppressed)     |
| `outbound`    | Array of messages that **would have been sent** to the user via WhatsApp      |
| `suppressed`  | `true` if the greeting classifier filtered the reply                          |
| `classifier`  | `{ ran, decision, reason?, ... }` — diagnostic info on greeting classification |
| `error`       | Error message if `status` is `bot_error`                                      |

### Sample scenarios

**Greeting suppressed:**
```json
{
  "status": "greeting_suppressed",
  "botReply": "שלום וברכה! במה אוכל לעזור לך היום?",
  "outbound": ["הודעת ברכה מהקונקטור"],
  "suppressed": true,
  "classifier": { "ran": true, "decision": "greeting" }
}
```

**PII blocked:**
```json
{
  "status": "pii_blocked",
  "outbound": ["אנא המנע משליחה של מידע אישי בשיחה זו"]
}
```

**Bot error (e.g. NIVI 503):**
```json
{
  "status": "bot_error",
  "error": "Request failed with status code 503",
  "outbound": ["מצטערים, יש תקלה במערכת. אנא נסה שוב מאוחר יותר."]
}
```

---

## 4. What the test endpoint does (vs. production)

| Behavior              | `/webhook/:id` (prod)     | `/webhook/:id/test`        |
|-----------------------|---------------------------|----------------------------|
| Returns `200` in <5s  | ✅ (then processes async)  | ✅ (after full processing) |
| Sends WhatsApp message| ✅                         | ❌ (captured in `outbound`) |
| Persists to MongoDB   | ✅                         | ✅ (same code path)         |
| Calls NIVI / LLM      | ✅                         | ✅                          |
| Returns bot reply     | ❌                         | ✅                          |

> **Note:** the test endpoint still writes to the DB so the conversation reflects reality. If you don't want pollution, use a dedicated test phone number and delete those conversations periodically.

---

## 5. Quick examples

### PowerShell
```powershell
$body = @{
  object = 'whatsapp_business_account'
  entry = @(@{ changes = @(@{ field = 'messages'; value = @{ messages = @(@{
    from = '972500000000'
    id = "wamid.TEST_$(Get-Random)"
    timestamp = '1700000000'
    type = 'text'
    text = @{ body = 'מה שעות הפעילות?' }
  })}})})
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post `
  -Uri "https://your-app.com/webhook/<CONNECTOR_ID>/test" `
  -ContentType 'application/json' -Body $body
```

### curl
```bash
curl -X POST "https://your-app.com/webhook/<CONNECTOR_ID>/test" \
  -H "Content-Type: application/json" \
  -d '{
    "object":"whatsapp_business_account",
    "entry":[{"changes":[{"field":"messages","value":{"messages":[
      {"from":"972500000000","id":"wamid.TEST_1","timestamp":"1700000000","type":"text","text":{"body":"מה שעות הפעילות?"}}
    ]}}]}]
  }'
```
