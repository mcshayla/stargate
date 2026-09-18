import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VERDICTS, VerdictBadge } from '@/components/verdict-badge'
import { cn } from '@/lib/utils'
import type { TrafficFilters as Filters } from '@/lib/hooks/use-traffic-filters'

const ALL_MODELS = '__all__'

/**
 * Traffic's filter toolbar: verdict toggles, a model picker, and free-text
 * search — all reflected into the URL by {@link Filters}. Verdicts read as
 * their badges (glyph + label) so the filter speaks the same language as the
 * rows it narrows; unselected verdicts dim rather than disappear.
 */
export function TrafficFilters({
  filters,
  models,
}: {
  filters: Filters
  models: string[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div
        aria-label="Filter by verdict"
        className="flex flex-wrap items-center gap-1"
        role="group"
      >
        {VERDICTS.map((verdict) => {
          const selected = filters.verdicts.has(verdict)
          // With no verdict selected every verdict passes, so nothing dims;
          // once a subset is chosen the rest recede.
          const dimmed = filters.verdicts.size > 0 && !selected
          return (
            <button
              aria-pressed={selected}
              className={cn(
                'rounded-md outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring',
                dimmed
                  ? 'opacity-40 hover:opacity-75'
                  : 'ring-1 ring-inset ring-border',
              )}
              key={verdict}
              onClick={() => filters.toggleVerdict(verdict)}
              type="button"
            >
              <VerdictBadge verdict={verdict} />
            </button>
          )
        })}
      </div>

      <Select
        onValueChange={(value) =>
          filters.setModel(value === ALL_MODELS ? null : value)
        }
        value={filters.model ?? ALL_MODELS}
      >
        <SelectTrigger aria-label="Filter by model" className="h-8 w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_MODELS}>All models</SelectItem>
          {models.map((model) => (
            <SelectItem className="font-mono text-xs" key={model} value={model}>
              {model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative w-full sm:w-[240px]">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 z-10 size-[18px] -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Search by key, model, team, or project"
          className="h-8 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
          onChange={(event) => filters.setQuery(event.target.value)}
          placeholder="Search key, model, team…"
          type="search"
          value={filters.query}
        />
        {filters.query === '' ? null : (
          <Button
            aria-label="Clear search"
            className="absolute top-1/2 right-1 z-10 -translate-y-1/2 focus-visible:ring-offset-0"
            onClick={() => filters.setQuery('')}
            size="icon-xs"
            variant="ghost"
          >
            <X />
          </Button>
        )}
      </div>

      {filters.active ? (
        <Button
          className="h-8"
          onClick={filters.clear}
          size="sm"
          variant="ghost"
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}
