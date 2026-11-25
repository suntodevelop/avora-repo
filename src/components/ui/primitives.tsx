"use client";
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type SelectHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { matchesSearch } from "@/lib/ui-data";
type Option = { value: string; label: string; disabled?: boolean };
function optionsOf(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === Fragment || child.type === "optgroup")
      return optionsOf(child.props.children);
    if (child.type !== "option") return [];
    return [
      {
        value: String(child.props.value ?? child.props.children ?? ""),
        label: Children.toArray(child.props.children).join(""),
        disabled: child.props.disabled,
      },
    ];
  });
}
export function Select({
  className = "",
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  id,
  name,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = optionsOf(children),
    [internal, setInternal] = useState(
      String(defaultValue ?? options[0]?.value ?? ""),
    ),
    [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [active, setActive] = useState(0),
    [position, setPosition] = useState({
      left: 0,
      top: 0,
      width: 200,
      maxHeight: 280,
    });
  const selected = String(value ?? internal),
    trigger = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null),
    listId = useId();
  const filtered = options.filter((option) =>
    matchesSearch(option.label, search),
  );
  const close = () => {
    setOpen(false);
    setSearch("");
  };
  const choose = (option: Option) => {
    if (option.disabled) return;
    setInternal(option.value);
    onChange?.({
      target: { value: option.value, name },
      currentTarget: { value: option.value, name },
    } as ChangeEvent<HTMLSelectElement>);
    close();
    trigger.current?.focus();
  };
  const show = () => {
    if (disabled) return;
    setSearch("");
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === selected),
      ),
    );
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const below = innerHeight - rect.bottom - 12;
      const height = Math.min(
        300,
        Math.max(140, below < 170 ? rect.top - 12 : below),
      );
      setPosition({
        left: Math.max(
          8,
          Math.min(rect.left, innerWidth - Math.max(rect.width, 200) - 8),
        ),
        top: below < 170 ? Math.max(8, rect.top - height - 6) : rect.bottom + 6,
        width: Math.min(Math.max(rect.width, 200), innerWidth - 16),
        maxHeight: height,
      });
    };
    place();
    const outside = (e: PointerEvent) => {
      if (
        !trigger.current?.contains(e.target as Node) &&
        !popup.current?.contains(e.target as Node)
      )
        close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    popup.current
      ?.querySelector(`[data-option-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  const keyboard = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Tab") {
      close();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (!open) {
        show();
        return;
      }
      setActive((current) =>
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? filtered.length - 1
            : Math.max(
                0,
                Math.min(
                  filtered.length - 1,
                  current + (e.key === "ArrowDown" ? 1 : -1),
                ),
              ),
      );
    }
    if ((e.key === "Enter" || e.key === " ") && e.target === trigger.current) {
      e.preventDefault();
      if (open && filtered[active]) choose(filtered[active]);
      else show();
    } else if (e.key === "Enter" && open && filtered[active]) {
      e.preventDefault();
      choose(filtered[active]);
    }
  };
  return (
    <span className={`select-root ${className}`}>
      <button
        ref={trigger}
        id={id}
        type="button"
        className="select-trigger"
        role="combobox"
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-required={props.required}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={keyboard}
      >
        <span>
          {options.find((option) => option.value === selected)?.label ||
            "Chọn một giá trị"}
        </span>
        <ChevronDown size={15} />
      </button>
      <select
        {...props}
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        value={selected}
        disabled={disabled}
        onChange={onChange}
        style={{ display: "none" }}
      >
        {children}
      </select>
      {open &&
        createPortal(
          <div
            className="select-popover"
            ref={popup}
            style={position}
            onKeyDown={keyboard}
          >
            {options.length > 7 && (
              <div className="select-search">
                <Search size={14} />
                <input
                  aria-label="Tìm trong danh sách"
                  placeholder="Tìm nhanh…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActive(0);
                  }}
                  autoFocus
                />
              </div>
            )}
            <div
              role="listbox"
              id={listId}
              aria-label={props["aria-label"] || "Danh sách lựa chọn"}
              className="select-options"
            >
              {filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  id={`${listId}-${index}`}
                  data-option-index={index}
                  aria-selected={selected === option.value}
                  disabled={option.disabled}
                  className={index === active ? "is-active" : ""}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {selected === option.value && <Check size={15} />}
                </button>
              ))}
              {!filtered.length && <p>Không có kết quả phù hợp.</p>}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
export function ScrollArea({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-scroll ${className}`} tabIndex={0} {...props} />;
}
