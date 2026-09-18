import { ArrowRight } from 'lucide-react'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { VerdictBadge } from '@/components/verdict-badge'
import { Duration, Money, TokenCount } from '@/components/values'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Receipt } from '@/lib/types'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm">{children}</dd>
    </div>
  )
}

/** The decision trace — the receipt's spine. Every step explains itself. */
function DecisionTrace({ receipt }: { receipt: Receipt }) {
  return (
    <ol className="relative ml-1.5 border-l border-border">
      {receipt.trace.map((step, i) => (
        <li key={`${step.stage}-${i}`} className="relative py-2 pl-5">
          <span
            className={cn(
              'absolute -left-[5px] top-3.5 size-2.5 rounded-full ring-4 ring-background',
              step.notable ? 'bg-warning-foreground' : 'bg-border-strong',
            )}
          />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">{step.label}</span>
            <Duration
              ms={step.durationMs}
              className="text-xs text-muted-foreground"
            />
          </div>
          <div
            className={cn(
              'text-xs',
              step.notable ? 'text-warning-foreground' : 'text-muted-foreground',
            )}
          >
            <span className="mr-1.5 uppercase tracking-wide opacity-60">
              {step.stage}
            </span>
            {step.outcome}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function ReceiptDrawer({
  receipt,
  onClose,
}: {
  receipt: Receipt | null
  onClose: () => void
}) {
  return (
    <Drawer
      side="right"
      open={receipt !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DrawerContent className="w-full sm:max-w-md">
        {receipt && (
          <>
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2 font-mono text-sm">
                {receipt.id}
                <VerdictBadge verdict={receipt.verdict} />
              </DrawerTitle>
              <DrawerDescription className="flex items-center gap-1.5 font-mono text-xs">
                {receipt.modelRequested}
                <ArrowRight className="size-3" aria-hidden />
                {receipt.modelResolved}
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-6">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Key">
                  <span className="font-mono">{receipt.key}</span>
                </Field>
                <Field label="Team / Project">
                  {receipt.team} / {receipt.project}
                </Field>
                <Field label="Provider">{receipt.provider}</Field>
                <Field label="Region">
                  <span className="font-mono">{receipt.region}</span>
                </Field>
                <Field label="Status">
                  <span className="font-mono">{receipt.statusCode}</span>
                </Field>
                <Field label="When">{formatClock(receipt.ts)}</Field>
                <Field label="Cost">
                  <Money value={receipt.costUsd} precise />
                </Field>
                <Field label="Latency">
                  <Duration ms={receipt.durationMs} />
                  {receipt.ttftMs != null && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (ttft <Duration ms={receipt.ttftMs} />)
                    </span>
                  )}
                </Field>
              </dl>

              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Decision trace
                </h3>
                <DecisionTrace receipt={receipt} />
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Token usage
                </h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(
                    [
                      ['Input', receipt.tokens.input],
                      ['Cached', receipt.tokens.cached],
                      ['Output', receipt.tokens.output],
                      ['Reasoning', receipt.tokens.reasoning],
                    ] as const
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-md border border-border py-2"
                    >
                      <TokenCount value={value} className="block text-sm" />
                      <span className="text-[10px] text-muted-foreground">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Priced against provider list rates at request time.
                </p>
              </section>

              {receipt.redactions.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Redactions
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {receipt.redactions.map((r) => (
                      <li
                        key={r.type}
                        className="flex items-center justify-between"
                      >
                        <span className="font-mono">{r.type}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {r.count} span{r.count === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Type and count only — captured content is never stored here.
                  </p>
                </section>
              )}
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
