"use client";

import React, { useCallback, useMemo, useState } from "react";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import { mergeAttributes, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";

type Props = {
  initialContent?: string;
  onChange?: (content: string) => void;
  editable?: boolean;
  mode?: "full" | "simple";
  externalAction?: {
    id: number;
    type: "insert-section" | "insert-step" | "insert-sub-step" | "convert-to-step" | "add-step-case";
  } | null;
};

type EntryTypeOption = {
  label: string;
  defaultUnit: string;
};

type TimerMode = "countdown" | "countup" | "longrange";

const ENTRY_TYPE_OPTIONS: EntryTypeOption[] = [
  { label: "Undefined", defaultUnit: "" },
  { label: "Mass", defaultUnit: "g" },
  { label: "Volume", defaultUnit: "mL" },
  { label: "Concentration", defaultUnit: "mM" },
  { label: "Cell Count", defaultUnit: "cells" },
  { label: "Temperature", defaultUnit: "deg C" },
  { label: "pH", defaultUnit: "pH" },
  { label: "Time", defaultUnit: "min" },
];

const UNIT_OPTIONS = ["g", "mg", "ug", "mL", "uL", "L", "mM", "uM", "nM", "cells", "%", "min", "hr", "deg C", "pH"];

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function MeasurementFieldView({ node, updateAttributes, editor }: NodeViewProps) {
  const label = String(node.attrs.label ?? "Undefined");
  const unit = String(node.attrs.unit ?? "");
  const value = String(node.attrs.value ?? "");
  const inputWidth = `${Math.max(10, Math.min(64, value.length + 4))}ch`;

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle">
      <span className="inline-flex items-center gap-2 rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-900" contentEditable={false}>
        <span className="font-medium">{label}</span>
        <input
          value={value}
          onChange={(e) => updateAttributes({ value: e.target.value.replace(/[\n\r\t]/g, "") })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab") e.preventDefault();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/[\n\r\t]/g, "");
            updateAttributes({ value: `${value}${pasted}` });
          }}
          disabled={!editor.isEditable}
          placeholder="value"
          style={{ width: inputWidth }}
          className="min-w-[10ch] rounded border border-blue-200 bg-white px-2.5 py-1 text-xs text-zinc-900"
        />
        {unit ? <span>{unit}</span> : null}
      </span>
    </NodeViewWrapper>
  );
}

function TimerFieldView({ node }: NodeViewProps) {
  const label = String(node.attrs.label ?? "Timer");
  const seconds = Number(node.attrs.seconds ?? 60);
  const mode = String(node.attrs.mode ?? "countdown") as TimerMode;
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [firstStartedAt, setFirstStartedAt] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);

  React.useEffect(() => {
    setRemaining(seconds);
    setRunning(false);
    setLocked(false);
    setFirstStartedAt(null);
    setStartedAt(null);
    setEndedAt(null);
  }, [seconds]);

  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((prev) => {
        if (mode === "countup" || mode === "longrange") return prev + 1;
        const next = prev - 1;
        if (next <= 0) {
          setRunning(false);
          setLocked(true);
          setEndedAt(Date.now());
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [running]);

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle">
      <span className="inline-flex min-w-[14ch] flex-col gap-1 rounded border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-900" contentEditable={false}>
        <span className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          <span className="font-mono">{formatDuration(remaining)}</span>
        </span>
        {mode !== "countup" && <span className="text-[11px] opacity-80">Elapsed: {formatDuration(Math.max(0, seconds - remaining))}</span>}
        {firstStartedAt && <span className="text-[11px] opacity-80">First start: {new Date(firstStartedAt).toLocaleTimeString()}</span>}
        {mode === "longrange" && endedAt && startedAt && (
          <span className="text-[11px] opacity-80">
            {new Date(startedAt).toLocaleTimeString()} - {new Date(endedAt).toLocaleTimeString()}
          </span>
        )}
        <span className="flex items-center gap-1">
          <button
          onClick={() => {
            if (mode === "longrange") {
              if (locked && endedAt) return;
              if (!running) {
                const now = Date.now();
                if (!firstStartedAt) setFirstStartedAt(now);
                setStartedAt(now);
                setEndedAt(null);
                setRemaining(0);
                setRunning(true);
                setLocked(false);
              } else {
                setRunning(false);
                setEndedAt(Date.now());
                setLocked(true);
              }
              return;
            }
            if (locked) return;
            if (!running && !firstStartedAt) setFirstStartedAt(Date.now());
            setRunning((v) => !v);
          }}
          disabled={locked && !(mode === "longrange" && running)}
          className="rounded border border-sky-400 px-2 py-0.5 text-[11px] disabled:opacity-40"
        >
          {mode === "longrange" ? (running ? "End" : "Begin") : running ? "Pause" : "Start"}
        </button>
        <button
          onClick={() => {
            const confirmed = window.confirm("Reset timer? Use reset only for accidental clicks.");
            if (!confirmed) return;
            setRunning(false);
            setRemaining(seconds);
            setLocked(false);
            setFirstStartedAt(null);
            setStartedAt(null);
            setEndedAt(null);
          }}
          className="rounded border border-sky-400 px-2 py-0.5 text-[11px]"
        >
          Reset
        </button>
        </span>
      </span>
    </NodeViewWrapper>
  );
}

function ComponentFieldView({ node, updateAttributes, editor }: NodeViewProps) {
  const label = String(node.attrs.label ?? "Component");
  const unit = String(node.attrs.unit ?? "");
  const value = String(node.attrs.value ?? "");
  const componentInputWidth = `${Math.max(10, Math.min(64, value.length + 4))}ch`;
  return (
    <NodeViewWrapper as="span" className="inline-block align-middle">
      <span
        className="entry-component inline-flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-900"
        contentEditable={false}
      >
        <span className="h-3.5 w-3.5 rounded border border-emerald-500 bg-white" />
        <span className="font-medium">{label}</span>
        <input
          value={value}
          onChange={(e) => updateAttributes({ value: e.target.value.replace(/[\n\r\t]/g, "") })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab") e.preventDefault();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/[\n\r\t]/g, "");
            updateAttributes({ value: `${value}${pasted}` });
          }}
          disabled={!editor.isEditable}
          placeholder="value"
          style={{ width: componentInputWidth }}
          className="min-w-[10ch] rounded border border-emerald-200 bg-white px-2.5 py-1 text-xs text-zinc-900"
        />
        {unit ? <span>{unit}</span> : null}
      </span>
    </NodeViewWrapper>
  );
}

const MeasurementFieldNode = Node.create({
  name: "measurementField",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      label: { default: "Undefined" },
      unit: { default: "" },
      value: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-entry-node='measurement']" }];
  },
  renderHTML({ HTMLAttributes }) {
    const label = String(HTMLAttributes.label ?? "Undefined");
    const value = String(HTMLAttributes.value ?? "");
    const unit = String(HTMLAttributes.unit ?? "");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-entry-node": "measurement",
        class: "entry-measurement",
      }),
      `${label}: ${value || "__"}${unit ? ` ${unit}` : ""}`,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MeasurementFieldView);
  },
});

const TimerFieldNode = Node.create({
  name: "timerField",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      label: { default: "Timer" },
      seconds: { default: 60 },
      mode: { default: "countdown" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-entry-node='timer']" }];
  },
  renderHTML({ HTMLAttributes }) {
    const label = String(HTMLAttributes.label ?? "Timer");
    const seconds = Number(HTMLAttributes.seconds ?? 60);
    const mode = String(HTMLAttributes.mode ?? "countdown");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-entry-node": "timer",
        class: "entry-timer",
      }),
      `${label} (${mode === "countup" ? "count up" : mode === "longrange" ? "long range" : formatDuration(seconds)})`,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TimerFieldView);
  },
});

const ComponentFieldNode = Node.create({
  name: "componentField",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      label: { default: "Component" },
      unit: { default: "" },
      value: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-entry-node='component']" }];
  },
  renderHTML({ HTMLAttributes }) {
    const label = String(HTMLAttributes.label ?? "Component");
    const value = String(HTMLAttributes.value ?? "");
    const unit = String(HTMLAttributes.unit ?? "");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-entry-node": "component",
        class: "entry-component",
      }),
      `${label}: ${value || "__"}${unit ? ` ${unit}` : ""}`,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ComponentFieldView);
  },
});

export default function RichTextEditor({ initialContent = "", onChange, editable = true, mode = "full", externalAction = null }: Props) {
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showEntryFieldModal, setShowEntryFieldModal] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [entryType, setEntryType] = useState(ENTRY_TYPE_OPTIONS[0].label);
  const [entryUnit, setEntryUnit] = useState(ENTRY_TYPE_OPTIONS[0].defaultUnit);
  const [customLabel, setCustomLabel] = useState("");
  const [timerLabel, setTimerLabel] = useState("Step Timer");
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerMode, setTimerMode] = useState<TimerMode>("countdown");
  const [componentType, setComponentType] = useState(ENTRY_TYPE_OPTIONS[0].label);
  const [componentUnit, setComponentUnit] = useState(ENTRY_TYPE_OPTIONS[0].defaultUnit);
  const [componentCustomLabel, setComponentCustomLabel] = useState("");

  const handleUpdate = useCallback(
    ({ editor }: { editor: { getHTML: () => string } }) => {
      onChange?.(editor.getHTML());
    },
    [onChange]
  );

  const extensions = useMemo(
    () => {
      if (mode === "simple") {
        return [
          StarterKit.configure({
            heading: false,
            codeBlock: false,
            code: false,
            horizontalRule: false,
            blockquote: false,
            bulletList: { HTMLAttributes: { class: "list-disc pl-6 space-y-1" } },
            orderedList: { HTMLAttributes: { class: "list-decimal pl-6 space-y-1" } },
            listItem: { HTMLAttributes: { class: "leading-relaxed" } },
          }),
          Underline,
        ];
      }
      return [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4, 5, 6] },
          codeBlock: { languageClassPrefix: "language-" },
          bulletList: {
            HTMLAttributes: {
              class: "list-disc pl-6 space-y-1",
            },
          },
          orderedList: {
            HTMLAttributes: {
              class: "list-decimal pl-6 space-y-1",
            },
          },
          listItem: {
            HTMLAttributes: {
              class: "leading-relaxed",
            },
          },
        }),
        Image.configure({ allowBase64: true }),
        Table.configure({
          resizable: false,
          HTMLAttributes: {
            class: "border-collapse border border-blue-900 w-full table-fixed",
          },
        }),
        TableRow.extend({
          renderHTML() {
            return ["tr", { class: "border border-blue-900" }, 0];
          },
        }),
        TableCell.extend({
          renderHTML() {
            return ["td", { class: "border border-blue-900 p-2" }, 0];
          },
        }),
        TableHeader.extend({
          renderHTML() {
            return ["th", { class: "border border-blue-900 p-2 bg-blue-50" }, 0];
          },
        }),
        TaskList.configure({
          HTMLAttributes: {
            class: "step-list",
          },
        }),
        TaskItem.configure({
          nested: true,
          HTMLAttributes: {
            class: "step-item",
          },
        }),
        Underline,
        Link.configure({ openOnClick: false }),
        MeasurementFieldNode,
        TimerFieldNode,
        ComponentFieldNode,
      ];
    },
    [mode]
  );

  const editor = useEditor({
    extensions,
    content: initialContent || "<p></p>",
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "ProseMirror prose max-w-none min-h-[22rem] p-1 focus:outline-none",
      },
    },
    onUpdate: handleUpdate,
  });

  React.useEffect(() => {
    if (!editor || !externalAction) return;

    if (externalAction.type === "insert-section") {
      editor
        .chain()
        .focus()
        .insertContent(
          "<h2>Untitled section</h2><ul data-type='taskList'><li data-type='taskItem' data-checked='false'><p>Enter step description</p></li></ul><p></p>"
        )
        .run();
      return;
    }

    if (externalAction.type === "insert-step") {
      const inserted = editor.chain().focus().splitListItem("taskItem").run();
      if (!inserted) {
        editor
          .chain()
          .focus()
          .insertContent(
            "<ul data-type='taskList'><li data-type='taskItem' data-checked='false'><p>Enter step description</p></li></ul>"
          )
          .run();
      }
      return;
    }

    if (externalAction.type === "insert-sub-step") {
      const insertedSub = editor.chain().focus().splitListItem("taskItem").sinkListItem("taskItem").run();
      if (!insertedSub) {
        editor.chain().focus().insertContent("<p>Sub-step: </p>").run();
      }
      return;
    }

    if (externalAction.type === "convert-to-step") {
      const converted = editor.chain().focus().liftListItem("taskItem").run();
      if (!converted) {
        editor
          .chain()
          .focus()
          .insertContent(
            "<ul data-type='taskList'><li data-type='taskItem' data-checked='false'><p>Converted step</p></li></ul>"
          )
          .run();
      }
      return;
    }

    if (externalAction.type === "add-step-case") {
      editor.chain().focus().insertContent("<p><strong>Step-case:</strong> If [condition], then [action].</p>").run();
    }
  }, [editor, externalAction]);

  if (!editor) return <div className="text-gray-400">Loading editor...</div>;

  const handleEditorKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!editable) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    if (!editor.isActive("taskItem")) return;
    event.preventDefault();
    editor.chain().focus().splitListItem("taskItem").run();
  };

  const addImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({
        rows: parseInt(tableRows.toString()),
        cols: parseInt(tableCols.toString()),
        withHeaderRow: true,
      })
      .run();
    setShowTableModal(false);
  };

  const insertMeasurementField = () => {
    const selectedOption = ENTRY_TYPE_OPTIONS.find((option) => option.label === entryType);
    const label = customLabel.trim() || entryType;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "measurementField",
        attrs: {
          label,
          unit: entryUnit || selectedOption?.defaultUnit || "",
          value: "",
        },
      })
      .insertContent(" ")
      .run();
    setShowEntryFieldModal(false);
  };

  const insertTimerField = () => {
    const safeMinutes = Math.max(0, timerMinutes || 0);
    const safeSeconds = Math.min(59, Math.max(0, timerSeconds || 0));
    const totalSeconds = safeMinutes * 60 + safeSeconds;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "timerField",
        attrs: {
          label: timerLabel.trim() || "Step Timer",
          seconds: timerMode === "countdown" ? Math.max(1, totalSeconds) : 0,
          mode: timerMode,
        },
      })
      .insertContent(" ")
      .run();
    setShowTimerModal(false);
  };

  const insertComponentField = () => {
    const selectedOption = ENTRY_TYPE_OPTIONS.find((option) => option.label === componentType);
    const label = componentCustomLabel.trim() || componentType;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "componentField",
        attrs: {
          label,
          unit: componentUnit || selectedOption?.defaultUnit || "",
          value: "",
        },
      })
      .insertContent(" ")
      .run();
    setShowComponentModal(false);
    setComponentType(ENTRY_TYPE_OPTIONS[0].label);
    setComponentUnit(ENTRY_TYPE_OPTIONS[0].defaultUnit);
    setComponentCustomLabel("");
  };

  return (
    <div className="w-full overflow-hidden rounded border border-gray-300">
      {editable && mode === "simple" && (
        <div className="border-b border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!editor.can().chain().focus().toggleBold().run()}
              className={`rounded px-2 py-1 text-sm transition ${
                editor.isActive("bold")
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              title="Bold (Ctrl+B)"
            >
              <strong>B</strong>
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={!editor.can().chain().focus().toggleItalic().run()}
              className={`rounded px-2 py-1 text-sm transition ${
                editor.isActive("italic")
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              title="Italic (Ctrl+I)"
            >
              <em>I</em>
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`rounded px-2 py-1 text-sm transition ${
                editor.isActive("underline")
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              title="Underline (Ctrl+U)"
            >
              <u>U</u>
            </button>
            <div className="w-px bg-gray-300" />
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().chain().focus().undo().run()}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Undo"
            >
              Undo
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().chain().focus().redo().run()}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Redo"
            >
              Redo
            </button>
          </div>
        </div>
      )}

      {editable && mode === "full" && (
        <div className="space-y-2 border-b border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap gap-1">
            <select
              onChange={(e) => {
                const value = e.target.value;
                if (value === "p") {
                  editor.chain().focus().setParagraph().run();
                } else if (value.startsWith("h")) {
                  const level = parseInt(value[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
                  editor.chain().focus().setHeading({ level }).run();
                }
              }}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
            >
              <option value="p">Normal</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="h4">Subheader 1</option>
              <option value="h5">Subheader 2</option>
              <option value="h6">Subheader 3</option>
            </select>

            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!editor.can().chain().focus().toggleBold().run()}
              className={`rounded px-2 py-1 text-sm transition ${
                editor.isActive("bold")
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              title="Bold (Ctrl+B)"
            >
              <strong>B</strong>
            </button>

            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={!editor.can().chain().focus().toggleItalic().run()}
              className={`rounded px-2 py-1 text-sm transition ${
                editor.isActive("italic")
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              title="Italic (Ctrl+I)"
            >
              <em>I</em>
            </button>

            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`rounded px-2 py-1 text-sm transition ${
                editor.isActive("underline")
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              title="Underline (Ctrl+U)"
            >
              <u>U</u>
            </button>

            <div className="w-px bg-gray-300" />

            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`rounded px-2 py-1 text-sm transition ${
                editor.isActive("bulletList")
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              title="Bullet List"
            >
              • List
            </button>

            <button
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={`rounded px-2 py-1 text-sm transition ${
                editor.isActive("taskList")
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              title="Step List"
            >
              Step
            </button>

            <div className="w-px bg-gray-300" />

            <button
              onClick={() => setShowEntryFieldModal(true)}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              title="Insert Entry Field"
            >
              + Entry Field
            </button>
            <button
              onClick={() => setShowComponentModal(true)}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              title="Insert Component"
            >
              + Component
            </button>
            <button
              onClick={() => setShowTimerModal(true)}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              title="Insert Timer"
            >
              + Timer
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={`rounded px-2 py-1 text-sm transition ${
                editor.isActive("codeBlock")
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              title="Code Block"
            >
              {"<>"} Code
            </button>

            <button
              onClick={() => addImage()}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              title="Insert Image"
            >
              Image
            </button>

            <button
              onClick={() => setShowTableModal(true)}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              title="Insert Table"
            >
              Table
            </button>

            <div className="w-px bg-gray-300" />

            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().chain().focus().undo().run()}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Undo"
            >
              Undo
            </button>

            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().chain().focus().redo().run()}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Redo"
            >
              Redo
            </button>
          </div>
        </div>
      )}

      {showTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Insert Table</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Rows</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Columns</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={tableCols}
                  onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowTableModal(false)}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button onClick={insertTable} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {showEntryFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Insert Entry Field</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Field Type</label>
                <select
                  value={entryType}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEntryType(value);
                    const option = ENTRY_TYPE_OPTIONS.find((o) => o.label === value);
                    if (option) setEntryUnit(option.defaultUnit);
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                >
                  {ENTRY_TYPE_OPTIONS.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Custom Label (optional)</label>
                <input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g., Bead slurry volume"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
                <select
                  value={entryUnit}
                  onChange={(e) => setEntryUnit(e.target.value)}
                  disabled={entryType === "Undefined"}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                >
                  <option value="">No unit</option>
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowEntryFieldModal(false)}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={insertMeasurementField}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {showTimerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Insert Timer</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Timer Label</label>
                <input
                  value={timerLabel}
                  onChange={(e) => setTimerLabel(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Timer Type</label>
                <select
                  value={timerMode}
                  onChange={(e) => setTimerMode(e.target.value as TimerMode)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                >
                  <option value="countdown">Countdown</option>
                  <option value="countup">Count Up</option>
                  <option value="longrange">Long-range</option>
                </select>
              </div>
              <div className={`grid grid-cols-2 gap-3 ${timerMode !== "countdown" ? "opacity-60" : ""}`}>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Minutes</label>
                  <input
                    type="number"
                    min="0"
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    disabled={timerMode !== "countdown"}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Seconds</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                    disabled={timerMode !== "countdown"}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowTimerModal(false)}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button onClick={insertTimerField} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {showComponentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Insert Component</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Component Type</label>
                <select
                  value={componentType}
                  onChange={(e) => {
                    const value = e.target.value;
                    setComponentType(value);
                    const option = ENTRY_TYPE_OPTIONS.find((o) => o.label === value);
                    if (option) setComponentUnit(option.defaultUnit);
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                >
                  {ENTRY_TYPE_OPTIONS.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Custom Label (optional)</label>
                <input
                  value={componentCustomLabel}
                  onChange={(e) => setComponentCustomLabel(e.target.value)}
                  placeholder="e.g., Template plasmid"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
                <select
                  value={componentUnit}
                  onChange={(e) => setComponentUnit(e.target.value)}
                  disabled={componentType === "Undefined"}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                >
                  <option value="">No unit</option>
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                In runs, each component gets its own checkbox. The step checkbox auto-completes only when all
                components in that step are checked.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowComponentModal(false)}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button onClick={insertComponentField} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="min-h-64 bg-white p-4 text-gray-900 focus-within:ring-1 focus-within:ring-blue-500"
        onMouseDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest(".ProseMirror")) return;
          editor.chain().focus().run();
        }}
      >
        <EditorContent editor={editor} className="tiptap-root min-h-[22rem]" onKeyDown={handleEditorKeyDown} />
      </div>
    </div>
  );
}
