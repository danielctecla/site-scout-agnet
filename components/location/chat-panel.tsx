"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  askAgent,
  type ChatMessage,
} from "@/app/(protected)/evaluations/actions";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

// SPEC-LOC-10: a right-side panel on desktop, a separate sheet on mobile.
// Messages live only in this component's state.
export function ChatPanel({ evaluationId }: { evaluationId: string }) {
  const t = useTranslations("location.chat");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function send(question: string) {
    const q = question.trim().slice(0, 1000);
    if (!q || pending) return;
    const history: ChatMessage[] = [...messages, { role: "user", text: q }];
    setMessages(history);
    setText("");
    setFailed(false);
    startTransition(async () => {
      const result = await askAgent(evaluationId, history);
      if ("answer" in result) {
        setMessages([...history, { role: "assistant", text: result.answer }]);
      } else {
        setFailed(true);
      }
    });
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 shadow-lg lg:hidden"
      >
        {t("open")}
      </Button>
      <aside
        id="agent"
        aria-label={t("title")}
        className={cx(
          "flex-col overflow-hidden bg-white",
          open
            ? "fixed inset-x-0 top-16 bottom-0 z-50 flex rounded-t-2xl shadow-2xl"
            : "hidden",
          "lg:sticky lg:top-6 lg:z-auto lg:flex lg:h-[min(860px,calc(100dvh-48px))] lg:max-w-105 lg:flex-[1_1_360px] lg:rounded-xl lg:border lg:border-divider lg:shadow-none",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-divider px-6 py-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-label font-semibold">{t("title")}</h2>
            <p className="text-note text-ink-tertiary">{t("hint")}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("close")}
            className="-m-2 flex size-11 items-center justify-center rounded-lg lg:hidden"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>
        <div
          aria-live="polite"
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-6"
        >
          {messages.map((m, i) => (
            <p
              key={i}
              className={cx(
                "max-w-[90%] px-3.5 py-3 text-label whitespace-pre-line",
                m.role === "user"
                  ? "self-end rounded-xl rounded-br-sm bg-ink text-white"
                  : "self-start rounded-xl rounded-bl-sm bg-panel",
              )}
            >
              <span className="sr-only">
                {m.role === "user" ? t("you") : t("agent")}:{" "}
              </span>
              {m.text}
            </p>
          ))}
          {pending ? (
            <p className="text-note text-ink-tertiary">{t("thinking")}</p>
          ) : null}
          {failed ? (
            <p role="alert" className="text-note text-error-ink">
              {t("error")}
            </p>
          ) : null}
        </div>
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2 px-6 pb-2">
            {[t("suggestMissing"), t("suggestCompetition")].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="h-9 rounded-full border border-border bg-white px-3 text-note hover:bg-panel"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(text);
          }}
          className="flex gap-2 px-6 pt-3 pb-6"
        >
          <label htmlFor="agent-question" className="sr-only">
            {t("label")}
          </label>
          <input
            id="agent-question"
            value={text}
            maxLength={1000}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("placeholder")}
            className="h-11 min-w-0 flex-1 rounded-lg border border-border px-3.5 text-label focus:border-ink focus:ring-3 focus:ring-ink/12 focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={pending || !text.trim()}>
            {t("send")}
          </Button>
        </form>
      </aside>
    </>
  );
}
