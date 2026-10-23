import type { ReactNode } from "react";
import { METHODS } from "@/lib/domain";

type Spec = Record<string, string | number | undefined | null>;

export function SpecList({ spec }: { spec: Spec }) {
  const size = spec.widthMm || spec.heightMm ? `${spec.widthMm ?? "?"} × ${spec.heightMm ?? "?"} mm (Breite × Höhe)` : "";
  const rows: [string, string][] = [
    ["Artikel", String(spec.garment ?? "")],
    ["Kleidungsfarbe", String(spec.garmentColor ?? "")],
    ["Verfahren", METHODS[spec.method as keyof typeof METHODS] ?? String(spec.method ?? "")],
    ["Motivposition", String(spec.position ?? "")],
    ["Motivgröße", size],
    ["Farben / Garn", String(spec.colors ?? "")],
    ["Stückzahl", spec.quantity ? String(spec.quantity) : ""],
    ["Hinweise", String(spec.customerNote ?? "")],
  ];
  return (
    <dl className="divide-y divide-line text-sm">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-3 py-2.5 sm:grid-cols-[11rem_1fr]">
          <dt className="text-neutral-500">{k}</dt>
          <dd className="whitespace-pre-line break-words font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DocumentPreview({ src, mime, name }: { src: string; mime: string; name: string }) {
  if (mime === "application/pdf") {
    return (
      <div className="space-y-2">
        <object data={src} type="application/pdf" aria-label={`Vorschau ${name}`} className="h-[70vh] min-h-96 w-full rounded-lg border border-line bg-white">
          <p className="p-4 text-sm">Die Vorschau wird auf diesem Gerät nicht unterstützt.</p>
        </object>
        <a href={src} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm underline">
          PDF in neuem Tab öffnen
        </a>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`Entwurf: ${name}`} className="mx-auto h-auto max-h-[75vh] w-full rounded-lg border border-line bg-white object-contain" />
      <a href={src} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm underline">Bild in voller Größe öffnen</a>
    </div>
  );
}

export function CustomerShell({
  businessName, logoSrc, title, orderNumber, versionNumber, banner, children,
}: {
  businessName: string;
  logoSrc?: string | null;
  title: string;
  orderNumber: string;
  versionNumber: number;
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6 sm:py-10">
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logoSrc && <img src={logoSrc} alt="" className="h-10 w-auto max-w-40 object-contain" />}
        <span className="font-semibold">{businessName}</span>
      </header>
      <div>
        <p className="text-sm text-neutral-500">Auftrag {orderNumber}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-sm font-medium text-white">Version {versionNumber}</p>
      </div>
      {banner}
      {children}
    </div>
  );
}
