"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseSourceReferences } from "@/lib/client/source-parser";


interface Source {
  text: string;
  docName: string;
  chunkIndex: number;
  page?: number;
  section?: string;
  highlightRange?: { page: number; start: number; end: number };
}

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  onSourceClick?: (source: Source) => void;
  isLoading?: boolean;
  animationDelay?: number;
  tokenUsage?: TokenUsage;
}

// Recursively extract text from React children
function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (!children) return "";
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (React.isValidElement(children) && children.props) {
    return extractText((children.props as { children?: React.ReactNode }).children);
  }
  return "";
}

// Recursively render children, replacing [Source N] with clickable badges
function renderWithSources(
  children: React.ReactNode,
  sources?: Source[],
  onSourceClick?: (source: Source) => void,
  keyPrefix = ""
): React.ReactNode {
  if (typeof children === "string") {
    const parts = parseSourceReferences(children);
    if (parts.length === 1 && parts[0].type === "text") return children;
    return parts.map((part, i) =>
      part.type === "source" ? (
        <SourceBadge key={`${keyPrefix}s${i}`} value={part.value} index={part.index} sources={sources} onSourceClick={onSourceClick} />
      ) : (
        <React.Fragment key={`${keyPrefix}t${i}`}>{part.value}</React.Fragment>
      )
    );
  }

  if (typeof children === "number") return children;
  if (!children) return null;

  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <React.Fragment key={`${keyPrefix}a${i}`}>
        {renderWithSources(child, sources, onSourceClick, `${keyPrefix}a${i}_`)}
      </React.Fragment>
    ));
  }

  if (React.isValidElement(children)) {
    const el = children as React.ReactElement<{ children?: React.ReactNode }>;
    const childContent = el.props.children;
    if (childContent) {
      const newChildren = renderWithSources(childContent, sources, onSourceClick, `${keyPrefix}e_`);
      return React.cloneElement(el, {}, newChildren);
    }
  }

  return children;
}

function hasSourceRefs(children: React.ReactNode): boolean {
  return /\[Source\s+\d+/.test(extractText(children));
}

function SourceBadge({
  value,
  index,
  sources,
  onSourceClick,
}: {
  value: string;
  index?: number;
  sources?: Source[];
  onSourceClick?: (source: Source) => void;
}) {
  return (
    <button
      onClick={() => {
        if (sources && index !== undefined && sources[index]) {
          onSourceClick?.(sources[index]);
        }
      }}
      className="mx-0.5 inline-block cursor-pointer rounded bg-[#1B365D]/10 px-1.5 py-0.5 text-xs font-medium text-[#1B365D] transition-colors hover:bg-[#1B365D]/20"
    >
      {value}
    </button>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-[#1B365D]/40 animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#1B365D]/40 animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#1B365D]/40 animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

function ShimmerLine({ width }: { width: string }) {
  return (
    <div
      className="h-3 rounded animate-shimmer"
      style={{ width }}
    />
  );
}

function ThinkingShimmer() {
  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center gap-2">
        <ThinkingDots />
        <span className="text-xs text-[#8a8a82]">Thinking...</span>
      </div>
      <div className="flex flex-col gap-1.5 pt-1">
        <ShimmerLine width="90%" />
        <ShimmerLine width="75%" />
        <ShimmerLine width="60%" />
      </div>
    </div>
  );
}

function createSourceAware(
  Tag: "p" | "li" | "td",
  sources?: Source[],
  onSourceClick?: (source: Source) => void,
  extraClassName?: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function SourceAwareComponent(props: any) {
    const { children, className, ...rest } = props;
    const cls = [className, extraClassName].filter(Boolean).join(" ");
    if (children && hasSourceRefs(children)) {
      return <Tag {...rest} className={cls}>{renderWithSources(children, sources, onSourceClick)}</Tag>;
    }
    return <Tag {...rest} className={cls}>{children}</Tag>;
  };
}

function TokenUsageBadge({ usage }: { usage: TokenUsage }) {
  if (!usage.total_tokens) return null;
  return (
    <div className="mt-1.5 flex items-center gap-2 text-[10px] leading-none text-[#b0aeA4]">
      <span className="inline-flex items-center gap-1">
        <span className="rounded bg-[#1B365D]/5 px-1.5 py-0.5 font-mono">↑ {usage.prompt_tokens?.toLocaleString() ?? "?"}</span>
        <span className="text-[#d0cfc8]">/</span>
        <span className="rounded bg-[#1B365D]/5 px-1.5 py-0.5 font-mono">↓ {usage.completion_tokens?.toLocaleString() ?? "?"}</span>
      </span>
      <span className="text-[#d0cfc8]">·</span>
      <span className="rounded bg-[#1B365D]/8 px-1.5 py-0.5 font-mono text-[#8a8a82]">
        {usage.total_tokens?.toLocaleString()} tokens
      </span>
    </div>
  );
}

export function MessageBubble({ role, content, sources, onSourceClick, isLoading, animationDelay, tokenUsage }: MessageBubbleProps) {
  const isUser = role === "user";
  const animClass = isUser ? "animate-message-right" : "animate-message-left";
  const delayStyle = animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined;

  if (isUser) {
    const parts = parseSourceReferences(content);
    return (
      <div className={`flex w-full justify-end ${animClass}`} style={delayStyle}>
        <div className="max-w-full md:max-w-[75%] rounded-xl px-4 py-3 text-base md:text-sm leading-relaxed bg-[#1B365D]/8 text-[#2a2a28] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="whitespace-pre-wrap break-words">
            {parts.map((part, i) =>
              part.type === "source" ? (
                <SourceBadge key={i} value={part.value} index={part.index} sources={sources} onSourceClick={onSourceClick} />
              ) : (
                <span key={i}>{part.value}</span>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  const P = createSourceAware("p", sources, onSourceClick);
  const Li = createSourceAware("li", sources, onSourceClick);
  const Td = createSourceAware("td", sources, onSourceClick, "border border-[#e0ded6] px-3 py-1.5 text-[#4a4a46]");

  return (
    <div className={`flex w-full justify-start ${animClass}`} style={delayStyle}>
      <div className="max-w-full md:max-w-[85%] rounded-xl px-4 py-3 text-base md:text-sm leading-relaxed bg-[#faf9f3] text-[#2a2a28] shadow-[0_0_0_1px_rgba(0,0,0,0.05)] break-words">
        {isLoading && !content ? (
          <ThinkingShimmer />
        ) : (
          <div className="prose prose-sm prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-table:my-3 prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5 prose-th:border prose-td:border prose-th:border-[#e0ded6] prose-td:border-[#e0ded6] prose-th:bg-[#f5f4ed] max-w-none w-full">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: P,
                li: Li,
                table: ({ children }) => (
                  <div className="my-3 w-full overflow-x-auto" style={{ touchAction: "manipulation" }}>
                    <table className="min-w-max border-collapse text-sm">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-[#e0ded6] bg-[#f5f4ed] px-3 py-1.5 text-left font-medium text-[#2a2a28]">
                    {children}
                  </th>
                ),
                td: Td,
                code: ({ children, className }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="rounded bg-[#1B365D]/5 px-1.5 py-0.5 text-xs font-mono text-[#1B365D]">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <div className="my-3 overflow-x-auto overflow-y-hidden rounded-lg bg-[#2a2a28]" style={{ touchAction: "pan-x", WebkitOverflowScrolling: "touch" }}>
                      <code className="block p-3 text-xs font-mono text-[#e8e6de] whitespace-pre">
                        {children}
                      </code>
                    </div>
                  );
                },
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1B365D] underline underline-offset-2 hover:text-[#1B365D]/80"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
        {tokenUsage && <TokenUsageBadge usage={tokenUsage} />}
      </div>
    </div>
  );
}
