import { useEffect, useRef, useState } from "react";
import "./PromptModal.css";

export type PromptRequest = {
  title: string;
  initial?: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
};

type Props = {
  request: PromptRequest | null;
  onClose: () => void;
};

export function PromptModal({ request, onClose }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request) return;
    setValue(request.initial ?? "");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [request]);

  if (!request) return null;

  const submit = () => {
    request.onSubmit(value);
    onClose();
  };

  return (
    <div className="prompt-backdrop" onMouseDown={onClose}>
      <div className="prompt-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="prompt-title">{request.title}</div>
        <input
          ref={inputRef}
          className="prompt-input"
          type="text"
          value={value}
          placeholder={request.placeholder}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <div className="prompt-actions">
          <button className="prompt-btn" onClick={onClose}>
            Annuler
          </button>
          <button className="prompt-btn primary" onClick={submit}>
            {request.submitLabel ?? "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
