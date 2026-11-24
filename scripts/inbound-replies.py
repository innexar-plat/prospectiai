#!/usr/bin/env python3
"""
Lê respostas novas nas caixas de reply-to (servidor de e-mail innexar-mailserver, via doveadm —
sem senha) e envia ao backend do Precision: /api/cron/inbound-replies.

Cada mensagem processada ganha a keyword IMAP "PrecisionSeen" (não altera "lida/não lida", então
quem acompanha a caixa continua vendo a mensagem como nova). Cron: a cada 10 minutos.
"""
import json
import re
import subprocess
import sys
from email import policy
from email.parser import BytesParser
from email.utils import parseaddr

MAILBOXES = ["comercial@precisionia.com.br", "comercial@heavyclean.com.br"]
KEYWORD = "PrecisionSeen"
MAIL = "innexar-mailserver"
BACKEND = "prospector-backend"

QUOTE_START = re.compile(
    r"^\s*(Em .{0,200}escreveu:|On .{0,200}wrote:|-{2,}\s*Original Message|De:\s|From:\s|_{5,}|Enviado do meu)",
    re.I,
)


def doveadm(*args: str) -> bytes:
    return subprocess.run(["docker", "exec", MAIL, "doveadm", *args], capture_output=True, check=True).stdout


def new_uids(user: str) -> list[str]:
    out = doveadm("search", "-u", user, "mailbox", "INBOX", "NOT", "KEYWORD", KEYWORD, "SINCE", "14d").decode()
    return [line.split()[1] for line in out.splitlines() if len(line.split()) == 2]


def raw_message(user: str, uid: str) -> bytes:
    out = doveadm("fetch", "-u", user, "text", "mailbox", "INBOX", "uid", uid)
    # Output: "text:\n<raw message>" (doveadm prints the field name first).
    return out.split(b"\n", 1)[1] if out.startswith(b"text:") else out


def plain_text(msg) -> str:
    part = msg.get_body(preferencelist=("plain", "html"))
    if part is None:
        return ""
    text = part.get_content()
    if part.get_content_type() == "text/html":
        text = re.sub(r"<(br|/p|/div)[^>]*>", "\n", text, flags=re.I)
        text = re.sub(r"<[^>]+>", "", text)
    # "Em qui., 19 de nov. de 2026 às 08:17, Fulano <\nemail> escreveu:" often spans two lines.
    quote = re.search(r"(^|\n)[ \t]*(Em|On)[ \t][^\n]{0,200}(\n[^\n]{0,200})?[ \t](escreveu|wrote):", text)
    if quote:
        text = text[: quote.start()]
    lines = []
    for line in text.splitlines():
        if QUOTE_START.match(line):
            break
        if not line.lstrip().startswith(">"):
            lines.append(line)
    return "\n".join(lines).strip()[:20000]


def collect(user: str) -> list[tuple[str, dict]]:
    items = []
    for uid in new_uids(user):
        msg = BytesParser(policy=policy.default).parsebytes(raw_message(user, uid))
        name, addr = parseaddr(str(msg.get("From", "")))
        items.append((uid, {
            "mailbox": user,
            "messageId": str(msg.get("Message-ID", "") or "")[:500],
            "from": addr[:320],
            "fromName": name[:200] or None,
            "subject": str(msg.get("Subject", "") or "")[:500],
            "text": plain_text(msg),
            "autoSubmitted": str(msg.get("Auto-Submitted")) if msg.get("Auto-Submitted") else None,
            "precedence": str(msg.get("Precedence")) if msg.get("Precedence") else None,
            "xAutoreply": str(msg.get("X-Autoreply") or msg.get("X-Autorespond") or "") or None,
        }))
    return items


def post(replies: list[dict]) -> list[dict]:
    payload = json.dumps({"replies": replies}, ensure_ascii=False).encode()
    cmd = (
        'cat > /tmp/inbound-replies.json && '
        'wget -qO- --timeout=300 --header="Content-Type: application/json" '
        '--header="Authorization: Bearer $CRON_SECRET" --post-file=/tmp/inbound-replies.json '
        'http://127.0.0.1:4000/api/cron/inbound-replies; rm -f /tmp/inbound-replies.json'
    )
    res = subprocess.run(["docker", "exec", "-i", BACKEND, "sh", "-c", cmd], input=payload, capture_output=True, check=True)
    return json.loads(res.stdout or b"{}").get("results", [])


def main() -> None:
    for user in MAILBOXES:
        items = collect(user)
        if not items:
            continue
        results = post([data for _, data in items])
        for (uid, data), result in zip(items, results):
            if result.get("action") != "error":
                doveadm("flags", "add", "-u", user, KEYWORD, "mailbox", "INBOX", "uid", uid)
            print(f"{user} uid={uid} from={data['from']} → {result.get('action')}")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as err:
        print(f"erro: {err.cmd[:4]} → {err.stderr.decode(errors='ignore')[:300]}", file=sys.stderr)
        sys.exit(1)
