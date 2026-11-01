"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

type Message = { id: string; sender_id: string; sender_name?: string; client_message_id: string; body: string; created_at: string; is_own?: boolean; pending?: boolean; failed?: boolean };

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byClientId = new Map(current.map((message) => [message.client_message_id, message]));
  for (const message of incoming) byClientId.set(message.client_message_id, message);
  return [...byClientId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export function ContractChat({ contractId }: { contractId: string }) {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastRead = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/contracts/${contractId}/chain-state`, { cache: "no-store" }).then((response) => response.json()).then((payload) => {
      if (active) setConversationId(payload.data?.conversationId);
    }).catch(() => { if (active) setError("Conversation is unavailable."); });
    return () => { active = false; };
  }, [contractId]);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    async function refresh() {
      try {
        const response = await fetch(`/api/v1/conversations/${conversationId}/messages?limit=100`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Could not load messages.");
        if (!active) return;
        const incoming = payload.data.items as Message[];
        setMessages((current) => mergeMessages(current, incoming));
        const latest = incoming.at(-1);
        if (latest && latest.id !== lastRead.current) {
          lastRead.current = latest.id;
          void fetch(`/api/v1/conversations/${conversationId}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: latest.id }) });
        }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : "Could not load messages."); }
    }
    void refresh();
    const poll = window.setInterval(() => void refresh(), 3_000);
    return () => { active = false; window.clearInterval(poll); };
  }, [conversationId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text || !conversationId) return;
    const clientMessageId = crypto.randomUUID();
    const optimistic: Message = { id: clientMessageId, sender_id: "self", sender_name: "You", client_message_id: clientMessageId, body: text, created_at: new Date().toISOString(), pending: true };
    setMessages((current) => mergeMessages(current, [optimistic])); setBody(""); setSending(true); setError(undefined);
    try {
      const response = await fetch(`/api/v1/conversations/${conversationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientMessageId, body: text }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Message was not sent.");
      setMessages((current) => mergeMessages(current.filter((message) => message.client_message_id !== clientMessageId), [{ ...payload.data, sender_name: "You", is_own: true } as Message]));
    } catch (caught) {
      setMessages((current) => current.map((message) => message.client_message_id === clientMessageId ? { ...message, pending: false, failed: true } : message));
      setError(caught instanceof Error ? caught.message : "Message was not sent.");
    } finally { setSending(false); }
  }

  return <section className="workspacePanel chatPanel" aria-labelledby="contract-chat-heading"><div className="workspacePanelHead"><div><span className="eyebrow">Contract channel</span><h2 id="contract-chat-heading">Messages</h2></div><span className="statusPill">Durable chat</span></div>
    <div className="messageList" aria-live="polite">{messages.length ? messages.map((message) => <article className={`messageBubble${message.is_own || message.sender_id === "self" ? " ownMessage" : ""}`} key={message.client_message_id}><header><strong>{message.is_own ? "You" : message.sender_name ?? "Participant"}</strong><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time></header><p>{message.body}</p>{message.pending ? <small>Sending…</small> : message.failed ? <small role="alert">Not sent</small> : null}</article>) : <p className="mutedCopy">{conversationId ? "No messages yet." : "Chat opens as soon as the escrow is funded on-chain."}  Terms and decisions shared here remain available with the contract.</p>}<div ref={endRef} /></div>
    <form className="messageComposer" onSubmit={(event) => void send(event)}><label htmlFor="contract-message">Message</label><textarea id="contract-message" value={body} onChange={(event) => setBody(event.target.value)} maxLength={5_000} rows={3} placeholder="Write a clear project update…" disabled={!conversationId} /><div><small>{body.length}/5000</small><button className="button secondary" type="submit" disabled={sending || !conversationId || !body.trim()}>Send message</button></div></form>
    {error ? <p className="formNotice error" role="alert">{error}</p> : null}
  </section>;
}
