"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";
type Message = { id: string; role: Role; content: string; createdAt: number };
type Conversation = { id: string; title: string; createdAt: number; messages: Message[] };

const starter: Conversation = {
  id: "welcome",
  title: "Bienvenido a Jhunnior Chat",
  createdAt: Date.now(),
  messages: [],
};

const suggestions = [
  { icon: "✦", title: "Explícame", text: "Explícame un concepto complejo de forma sencilla" },
  { icon: "⌘", title: "Crea", text: "Ayúdame a crear un plan para mi próximo proyecto" },
  { icon: "◌", title: "Resume", text: "Resume las ideas principales de un texto" },
  { icon: "↗", title: "Mejora", text: "Mejora este texto para que sea más claro y profesional" },
];

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function conversationTitle(text: string) {
  return text.length > 34 ? `${text.slice(0, 34)}…` : text;
}

function formatDay(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days === 0) return "HOY";
  if (days === 1) return "AYER";
  return "ANTERIORES";
}

export function ChatApp() {
  const [conversations, setConversations] = useState<Conversation[]>([starter]);
  const [activeId, setActiveId] = useState(starter.id);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isSending, setIsSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("jhunnior-chat-conversations");
    const savedTheme = window.localStorage.getItem("jhunnior-chat-theme") as "light" | "dark" | null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Conversation[];
        if (parsed.length) {
          setConversations(parsed);
          setActiveId(parsed[0].id);
        }
      } catch { /* Ignore malformed local data. */ }
    }
    if (savedTheme) setTheme(savedTheme);
    setHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (hydrated) window.localStorage.setItem("jhunnior-chat-theme", theme);
  }, [theme, hydrated]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem("jhunnior-chat-conversations", JSON.stringify(conversations));
  }, [conversations, hydrated]);

  const active = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? conversations[0],
    [activeId, conversations],
  );

  const newChat = () => {
    const conversation: Conversation = { id: id(), title: "Nuevo chat", createdAt: Date.now(), messages: [] };
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setInput("");
    inputRef.current?.focus();
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || isSending || !active) return;
    const userMessage: Message = { id: id(), role: "user", content: text, createdAt: Date.now() };
    const targetId = active.id;
    setInput("");
    setIsSending(true);
    setConversations((current) => current.map((item) => item.id === targetId ? {
      ...item,
      title: item.messages.length ? item.title : conversationTitle(text),
      messages: [...item.messages, userMessage],
    } : item));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error("No fue posible generar la respuesta.");
      const reply: Message = { id: id(), role: "assistant", content: result.message ?? "No pude generar una respuesta.", createdAt: Date.now() };
      setConversations((current) => current.map((item) => item.id === targetId ? { ...item, messages: [...item.messages, reply] } : item));
    } catch {
      const reply: Message = { id: id(), role: "assistant", content: "Hubo un problema al conectar. Comprueba que el servidor esté en ejecución e inténtalo de nuevo.", createdAt: Date.now() };
      setConversations((current) => current.map((item) => item.id === targetId ? { ...item, messages: [...item.messages, reply] } : item));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const grouped = conversations.reduce<Record<string, Conversation[]>>((groups, conversation) => {
    const day = formatDay(conversation.createdAt);
    (groups[day] ??= []).push(conversation);
    return groups;
  }, {});

  return (
    <main className="shell">
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label="Historial de conversaciones">
        <div className="brand-row">
          <div className="brand-mark">J</div>
          <span>Jhunnior Chat</span>
          <button className="icon-button mobile-close" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)}>×</button>
        </div>
        <button className="new-chat" onClick={newChat}><span>＋</span> Nuevo chat <kbd>⌘ K</kbd></button>
        <div className="search"><span>⌕</span><input aria-label="Buscar conversaciones" placeholder="Buscar conversaciones" /></div>
        <nav className="history">
          {Object.entries(grouped).map(([day, items]) => (
            <section key={day}>
              <h2>{day}</h2>
              {items.map((conversation) => <button key={conversation.id} className={`history-item ${conversation.id === activeId ? "active" : ""}`} onClick={() => { setActiveId(conversation.id); setSidebarOpen(false); }}><span className="bubble">◌</span><span>{conversation.title}</span></button>)}
            </section>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile"><span className="avatar">J</span><span><strong>Jhunnior</strong><small>Plan gratuito</small></span><span className="dots">•••</span></button>
          <button className="theme-button" onClick={() => setTheme((value) => value === "light" ? "dark" : "light")}><span>{theme === "light" ? "☾" : "☀"}</span> {theme === "light" ? "Modo oscuro" : "Modo claro"}<span>›</span></button>
        </div>
      </aside>
      <section className="chat-panel">
        <header className="topbar">
          <button className="icon-button" aria-label="Abrir menú" onClick={() => setSidebarOpen((open) => !open)}><span className="hamburger">☰</span></button>
          <button className="model-pill">Jhunnior AI <span>⌄</span></button>
          <div className="topbar-actions"><button className="icon-button" aria-label="Compartir conversación">↥</button><button className="icon-button" aria-label="Más opciones">•••</button></div>
        </header>
        <div className="chat-body">
          {active?.messages.length ? (
            <div className="messages">
              {active.messages.map((message) => <article key={message.id} className={`message ${message.role}`}>
                <div className={`message-avatar ${message.role}`}>{message.role === "user" ? "J" : "✦"}</div>
                <div className="message-content">{message.content.split("\n").map((line, index) => <p key={`${message.id}-${index}`}>{line || " "}</p>)}
                  {message.role === "assistant" && <div className="message-actions"><button aria-label="Copiar respuesta">□</button><button aria-label="Me gusta">♡</button><button aria-label="No me gusta">♧</button></div>}
                </div>
              </article>)}
              {isSending && <article className="message assistant"><div className="message-avatar assistant">✦</div><div className="typing"><i /><i /><i /></div></article>}
            </div>
          ) : (
            <div className="welcome">
              <div className="hero-orbit"><div className="hero-mark">J</div></div>
              <p className="eyebrow">HOLA, JHUNNIOR</p>
              <h1>¿En qué puedo ayudarte hoy?</h1>
              <p className="subhead">Tu asistente para pensar, crear y resolver.</p>
              <div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion.title} onClick={() => setInput(suggestion.text)}><span className="suggestion-icon">{suggestion.icon}</span><strong>{suggestion.title}</strong><small>{suggestion.text}</small><span className="arrow">↗</span></button>)}</div>
            </div>
          )}
        </div>
        <div className="composer-area">
          <form className="composer" onSubmit={sendMessage}>
            <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder="Escribe un mensaje..." rows={1} aria-label="Mensaje" />
            <div className="composer-tools"><div><button type="button" aria-label="Adjuntar archivo">＋</button><button type="button" aria-label="Herramientas">◎</button></div><button className="send" type="submit" disabled={!input.trim() || isSending} aria-label="Enviar mensaje">↑</button></div>
          </form>
          <p className="disclaimer">Jhunnior Chat puede cometer errores. Verifica la información importante.</p>
        </div>
      </section>
    </main>
  );
}
