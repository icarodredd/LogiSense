"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical } from "lucide-react";
import { Children, cloneElement, isValidElement, useState, type ReactNode } from "react";

type SortDirection = "asc" | "desc";

function textValue(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textValue).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return textValue(node.props.children);
  return "";
}

export function SortableTable({ children, className = "data-table" }: { children: ReactNode; className?: string }) {
  const [columnOrder, setColumnOrder] = useState<number[] | null>(null);
  const [sort, setSort] = useState<{ column: number; direction: SortDirection } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  const sections = Children.toArray(children);
  const header = sections.find((section) => isValidElement(section) && section.type === "thead");
  const body = sections.find((section) => isValidElement(section) && section.type === "tbody");
  const headerRow = header && isValidElement<{ children?: ReactNode }>(header)
    ? Children.toArray(header.props.children)[0]
    : null;
  const headerCells = headerRow && isValidElement<{ children?: ReactNode }>(headerRow)
    ? Children.toArray(headerRow.props.children)
    : [];
  const order = columnOrder ?? headerCells.map((_, index) => index);

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setColumnOrder(next);
  }

  const reorderedHeader = header && isValidElement<{ children?: ReactNode }>(header) && headerRow && isValidElement<{ children?: ReactNode }>(headerRow)
    ? <thead {...header.props}><tr {...headerRow.props}>{order.map((column) => {
      const cell = headerCells[column];
      const sortable = Boolean(cell && isValidElement<{ children?: ReactNode }>(cell) && textValue(cell.props.children).trim());
      const active = sort?.column === column;
      return isValidElement<{ children?: ReactNode; className?: string }>(cell)
        ? <th key={`header-${column}`} {...cell.props} draggable={sortable} onDragStart={() => setDraggedColumn(column)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedColumn !== null) reorder(order.indexOf(draggedColumn), order.indexOf(column)); setDraggedColumn(null); }} onClick={() => sortable && setSort(active ? { column, direction: sort.direction === "asc" ? "desc" : "asc" } : { column, direction: "asc" })} className={`${cell.props.className ?? ""} sortable-header`}><div className="sortable-header-content"><span>{cell.props.children}</span>{sortable && (active ? (sort.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ChevronsUpDown size={13} />)}{sortable && <GripVertical size={12} className="column-grip" />}</div></th>
        : cell;
    })}</tr></thead>
    : header;

  const reorderedBody = body && isValidElement<{ children?: ReactNode }>(body)
    ? <tbody {...body.props}>{Children.toArray(body.props.children).sort((a, b) => {
      if (!sort || !isValidElement<{ children?: ReactNode }>(a) || !isValidElement<{ children?: ReactNode }>(b)) return 0;
      const aCells = Children.toArray(a.props.children);
      const bCells = Children.toArray(b.props.children);
      const left = textValue(aCells[sort.column]).toLocaleLowerCase();
      const right = textValue(bCells[sort.column]).toLocaleLowerCase();
      const numericLeft = Number(left.replace(/[^\d,.-]/g, "").replace(",", "."));
      const numericRight = Number(right.replace(/[^\d,.-]/g, "").replace(",", "."));
      const comparison = Number.isNaN(numericLeft) || Number.isNaN(numericRight)
        ? left.localeCompare(right, "pt-BR")
        : numericLeft - numericRight;
      return sort.direction === "asc" ? comparison : -comparison;
    }).map((row, rowIndex) => {
      if (!isValidElement<{ children?: ReactNode }>(row)) return row;
      const cells = Children.toArray(row.props.children);
      return <tr key={row.key ?? rowIndex} {...row.props}>{order.map((column) => {
        const cell = cells[column];
        return isValidElement(cell)
          ? cloneElement(cell, { key: `cell-${row.key ?? rowIndex}-${column}` })
          : cell;
      })}</tr>;
    })}</tbody>
    : body;

  return <table className={className}>{sections.map((section) => section === header ? reorderedHeader : section === body ? reorderedBody : section)}</table>;
}
