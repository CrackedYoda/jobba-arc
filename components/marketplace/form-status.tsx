"use client";

import { useState, type FormEvent, type ReactNode } from "react";

export function PreviewForm({ children, message, className = "marketForm" }: { children: ReactNode; message: string; className?: string }) {
  const [submitted, setSubmitted] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }
  return <form className={className} onSubmit={submit}>{children}{submitted ? <p className="formNotice" role="status">{message}</p> : null}</form>;
}
