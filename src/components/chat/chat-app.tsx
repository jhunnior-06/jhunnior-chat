"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Role = "user" | "assistant";
type Attachment = { name: string; size: number; type: string };
type Message = { id: string; role: Role; content: string; createdAt: number; attachments?: Attachment[] };
type Conversation = { id: string; title: string; createdAt: number; messages: Message[] };
type ChatApiResponse = { message?: string; error?: { message?: string } };

const starter: Conversation = { id: "welcome", title: "Bienvenido a Jhunnior Chat", createdAt: Date.now(), messages: [] };
const suggestions = [
  { icon: "✦", title: "Explícame", text: "Explícame un concepto complejo de forma sencilla" },
  { icon: "⌘", title: "Crea", text: "Ayúdame a crear un plan para mi próximo proyecto" },
  { icon: "◌", title: "Resume", text: "Resume las ideas principales de un texto" },
  { icon: "↗", title: "Mejora", text: "Mejora este texto para que sea más claro y profesional" },
];
const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function conversationTitle(text: string) { return text.length > 34 ? `${text.slice(0, 34)}...` : text || "Documentos adjuntos"; }
function formatDay(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days === 0) return "HOY";
  if (days === 1) return "AYER";
  return "ANTERIORES";
}
function fileLabel(file: Attachment) {
  const sizeInMb = file.size / 1024 / 1024;
  return `${file.name} (${sizeInMb >= 1 ? `${sizeInMb.toFixed(1)} MB` : `${Math.ceil(file.size / 1024)} KB`})`;
}

export function ChatApp() {
  const { user } = useUser();
  const [conversations, setConversations] = useState<Conversation[]>([starter]);
  const [activeId, setActiveId] = useState(starter.id);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("jhunnior-chat-conversations");
    const savedTheme = window.localStorage.getItem("jhunnior-chat-theme") as "light" | "dark" | null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Conversation[];
        if (parsed.length) { setConversations(parsed); setActiveId(parsed[0].id); }
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

  const active = useMemo(() => conversations.find((conversation) => conversation.id === activeId) ?? conversations[0], [activeId, conversations]);
  const newChat = () => {
    const conversation: Conversation = { id: id(), title: "Nuevo chat", createdAt: Date.now(), messages: [] };
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setInput(""); setAttachments([]); setUploadError(""); inputRef.current?.focus();
  };
  const addAttachments = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const selected = Array.from(selectedFiles);
    const rejected = selected.find((file) => file.size > MAX_FILE_SIZE);
    if (rejected) { setUploadError(`"${rejected.name}" supera el limite de 10 MB.`); return; }
    setAttachments([...attachments, ...selected].slice(0, MAX_ATTACHMENTS));
    setUploadError(selected.length + attachments.length > MAX_ATTACHMENTS ? "Solo puedes adjuntar hasta 5 archivos." : "");
  };
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => { addAttachments(event.target.files); event.target.value = ""; };
  const removeAttachment = (index: number) => { setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index)); setUploadError(""); };
  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if ((!text && !attachments.length) || isSending || !active) return;
    const filesToSend = attachments;
    const userMessage: Message = { id: id(), role: "user", content: text, createdAt: Date.now(), attachments: filesToSend.map((file) => ({ name: file.name, size: file.size, type: file.type })) };
    const targetId = active.id;
    setInput(""); setAttachments([]); setUploadError(""); setIsSending(true);
    setConversations((current) => current.map((item) => item.id === targetId ? { ...item, title: item.messages.length ? item.title : conversationTitle(text), messages: [...item.messages, userMessage] } : item));
    try {
      const payload = new FormData();
      payload.set("text", text);
      filesToSend.forEach((file) => payload.append("files", file));
      const response = await fetch("/api/chat", { method: "POST", body: payload });
      const result = (await response.json().catch(() => null)) as ChatApiResponse | null;
      if (!response.ok) throw new Error(result?.error?.message ?? "No fue posible generar la respuesta.");
      const reply: Message = { id: id(), role: "assistant", content: result?.message ?? "No pude generar una respuesta.", createdAt: Date.now() };
      setConversations((current) => current.map((item) => item.id === targetId ? { ...item, messages: [...item.messages, reply] } : item));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Hubo un problema al conectar. Comprueba el servidor e intentalo de nuevo.";
      const reply: Message = { id: id(), role: "assistant", content: message, createdAt: Date.now() };
      setConversations((current) => current.map((item) => item.id === targetId ? { ...item, messages: [...item.messages, reply] } : item));
    } finally { setIsSending(false); inputRef.current?.focus(); }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); }
  };
  const grouped = conversations.reduce<Record<string, Conversation[]>>((groups, conversation) => {
    const day = formatDay(conversation.createdAt); (groups[day] ??= []).push(conversation); return groups;
  }, {});

  return <main className="shell">
    <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label="Historial de conversaciones">
      <div className="brand-row"><div className="brand-mark">J</div><span>Jhunnior Chat</span><button className="icon-button mobile-close" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)}>×</button></div>
      <button className="new-chat" onClick={newChat}><span>＋</span> Nuevo chat <kbd>⌘ K</kbd></button>
      <div className="search"><span>⌕</span><input aria-label="Buscar conversaciones" placeholder="Buscar conversaciones" /></div>
      <nav className="history">{Object.entries(grouped).map(([day, items]) => <section key={day}><h2>{day}</h2>{items.map((conversation) => <button key={conversation.id} className={`history-item ${conversation.id === activeId ? "active" : ""}`} onClick={() => { setActiveId(conversation.id); setSidebarOpen(false); }}><span className="bubble">◌</span><span>{conversation.title}</span></button>)}</section>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><span className="avatar">{user?.firstName?.slice(0, 1).toUpperCase() ?? "U"}</span><span><strong>{user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Usuario"}</strong><small>Plan gratuito</small></span><span className="user-menu"><UserButton /></span></div><button className="theme-button" onClick={() => setTheme((value) => value === "light" ? "dark" : "light")}><span>{theme === "light" ? "☾" : "☀"}</span> {theme === "light" ? "Modo oscuro" : "Modo claro"}<span>›</span></button></div>
    </aside>
    <button className={`sidebar-toggle ${sidebarOpen ? "is-expanded" : ""}`} onClick={() => setSidebarOpen((open) => !open)} aria-label={sidebarOpen ? "Minimizar historial" : "Mostrar historial"} aria-expanded={sidebarOpen}><span>‹</span></button>
    <section className="chat-panel">
      <header className="topbar"><button className="icon-button" aria-label="Abrir menú" onClick={() => setSidebarOpen((open) => !open)}><span className="hamburger">☰</span></button><button className="model-pill">Jhunnior AI <span>⌄</span></button><div className="topbar-actions"><button className="icon-button" aria-label="Compartir conversación">↥</button><button className="icon-button" aria-label="Más opciones">•••</button></div></header>
      <div className="chat-body">{active?.messages.length ? <div className="messages">{active.messages.map((message) => <article key={message.id} className={`message ${message.role}`}><div className={`message-avatar ${message.role}`}>{message.role === "user" ? "U" : "✦"}</div><div className="message-content">{message.content ? message.role === "assistant" ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown> : message.content.split("\n").map((line, index) => <p key={`${message.id}-${index}`}>{line || " "}</p>) : null}{message.attachments?.length ? <ul className="attachment-list">{message.attachments.map((file, index) => <li key={`${message.id}-${index}`}>Documento: {fileLabel(file)}</li>)}</ul> : null}{message.role === "assistant" ? <div className="message-actions"><button aria-label="Copiar respuesta">□</button><button aria-label="Me gusta">♡</button><button aria-label="No me gusta">♧</button></div> : null}</div></article>)}{isSending ? <article className="message assistant"><div className="message-avatar assistant">✦</div><div className="typing"><i /><i /><i /></div></article> : null}</div> : <div className="welcome"><div className="hero-orbit"><div className="hero-mark">J</div></div><p className="eyebrow">HOLA, {user?.firstName?.toUpperCase() ?? "USUARIO"}</p><h1>¿En qué puedo ayudarte hoy?</h1><p className="subhead">Tu asistente para pensar, crear y resolver.</p><div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion.title} onClick={() => setInput(suggestion.text)}><span className="suggestion-icon">{suggestion.icon}</span><strong>{suggestion.title}</strong><small>{suggestion.text}</small><span className="arrow">↗</span></button>)}</div></div>}</div>
      <div className="composer-area"><form className="composer" onSubmit={sendMessage}><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder="Escribe un mensaje..." rows={1} aria-label="Mensaje" /><input ref={fileInputRef} className="file-input" type="file" multiple onChange={onFileChange} accept={DOCUMENT_ACCEPT} />{attachments.length ? <ul className="pending-attachments" aria-label="Documentos adjuntos">{attachments.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`}><span>Documento: {file.name}</span><button type="button" onClick={() => removeAttachment(index)} aria-label={`Quitar ${file.name}`}>×</button></li>)}</ul> : null}{uploadError ? <p className="upload-error" role="alert">{uploadError}</p> : null}<div className="composer-tools"><div><button type="button" aria-label="Adjuntar documento" onClick={() => fileInputRef.current?.click()}>＋</button><button type="button" aria-label="Herramientas">◎</button></div><button className="send" type="submit" disabled={(!input.trim() && !attachments.length) || isSending} aria-label="Enviar mensaje">↑</button></div></form><p className="disclaimer">Jhunnior Chat puede cometer errores. Verifica la información importante.</p></div>
    </section>
  </main>;
}
