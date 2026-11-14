import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Send, ShieldCheck, Sparkles } from "lucide-react";
import { api, messageFromError } from "../services/api";
import { Badge, Button, Callout, PageHeader, Panel, Spinner, TextArea } from "../components/ui";
import { useToast } from "../hooks/useToast";
import type { CopilotAnswer } from "../types/api";

interface Exchange {
  question: string;
  answer: CopilotAnswer;
}

const STARTERS = [
  "What is our current security posture?",
  "Which identities are highest risk?",
  "Show me open incidents",
  "Any leaked credentials?",
  "How many access requests were denied?",
];

function DataList({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(
    ([, value]) => typeof value !== "object" || value === null,
  );
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line/50 pt-3 sm:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key}>
          <p className="text-[9px] uppercase tracking-wider text-faint">{key.replace(/_/g, " ")}</p>
          <p className="text-[11px] font-medium text-ink">{String(value)}</p>
        </div>
      ))}
    </div>
  );
}

export default function CopilotPage() {
  const toast = useToast();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (value: string) => api.askCopilot(value),
    onSuccess: (answer, value) => {
      setHistory((prev) => [...prev, { question: value, answer }]);
      setQuestion("");
      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    onError: (error) => toast.error("Copilot failed", messageFromError(error)),
  });

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2 || ask.isPending) return;
    ask.mutate(trimmed);
  };

  const suggestions = history.length
    ? history[history.length - 1].answer.suggestions
    : STARTERS;

  return (
    <>
      <PageHeader
        eyebrow="Analyst copilot"
        title="Ask AEGIS"
        description="A read-only assistant that answers questions about live posture, risk, incidents, leaks, sessions, devices, compliance, and red-team coverage. It never changes state."
        meta={
          <>
            <Badge tone="accent">Read-only</Badge>
            <span className="text-[10px] text-faint">Answers computed from backend state</span>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {history.length === 0 && (
            <Panel className="p-6 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Bot size={20} />
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">How can I help?</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted">
                Ask about the current security posture or drill into a specific area. Every answer
                is derived from the live platform — no state is modified.
              </p>
            </Panel>
          )}

          {history.map((exchange, index) => (
            <div key={index} className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent/15 px-3.5 py-2 text-xs text-ink">
                  {exchange.question}
                </div>
              </div>
              <Panel className="p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Bot size={13} />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                    {exchange.answer.intent.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-2.5 text-xs leading-5 text-muted">{exchange.answer.answer}</p>
                {exchange.answer.bullets.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5">
                    {exchange.answer.bullets.map((bullet, bulletIndex) => (
                      <li key={bulletIndex} className="flex gap-2 text-[11px] leading-5 text-muted">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
                <DataList data={exchange.answer.data} />
              </Panel>
            </div>
          ))}

          {ask.isPending && (
            <Panel className="flex items-center gap-2 p-4 text-xs text-muted">
              <Spinner size={14} /> Analyzing live state…
            </Panel>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="space-y-4">
          <Panel className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              <p className="text-xs font-semibold text-ink">Suggested questions</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submit(suggestion)}
                  disabled={ask.isPending}
                  className="rounded-lg border border-line/60 bg-raised/30 px-3 py-2 text-left text-[11px] leading-4 text-muted transition hover:border-accent/40 hover:text-ink disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </Panel>

          <Callout tone="info" title="Read-only by design">
            <span className="flex items-start gap-2">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-accent" />
              The copilot only reads platform state. Use Response playbooks on an incident to take
              containment actions.
            </span>
          </Callout>
        </div>
      </div>

      <Panel className="mt-4 p-4">
        <label className="label" htmlFor="copilot-question">
          Ask a question
        </label>
        <TextArea
          id="copilot-question"
          rows={2}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(question);
            }
          }}
          placeholder="e.g. Which identities are highest risk? (Enter to send, Shift+Enter for newline)"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-faint">
            Answers are advisory. Confirm before acting.
          </span>
          <Button
            variant="solid"
            size="sm"
            loading={ask.isPending}
            disabled={question.trim().length < 2}
            onClick={() => submit(question)}
          >
            <Send size={12} /> Ask
          </Button>
        </div>
      </Panel>
    </>
  );
}
