export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted p-4 font-mono text-xs text-foreground">
      <code>{children}</code>
    </pre>
  );
}
