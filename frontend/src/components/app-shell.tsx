import {
  Activity,
  DollarSign,
  KeyRound,
  LayoutDashboard,
  ListTree,
  Route,
  Search,
  Settings,
  ShieldCheck,
  Waypoints,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CommandPalette } from '@/components/command-palette'
import { DegradationBanner } from '@/components/degradation-banner'
import { TimeRange } from '@/components/time-range'
import { useDegradations } from '@/lib/hooks/use-degradations'
import { worstSeverity } from '@/lib/degradation'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

interface NavSection {
  label: string
  phase: number
  items: NavItem[]
}

// Navigation mirrors the spec's console structure. Only the Observe section is
// live in Phase 1; later phases are shown but disabled so the shape of the
// product is legible from day one.
const SECTIONS: NavSection[] = [
  {
    label: 'Observe',
    phase: 1,
    items: [
      { label: 'Overview', to: '/', icon: LayoutDashboard },
      { label: 'Traffic', to: '/traffic', icon: ListTree },
      { label: 'Spend', to: '/spend', icon: DollarSign },
    ],
  },
  {
    label: 'Configure',
    phase: 2,
    items: [
      { label: 'Models', to: '/models', icon: Waypoints },
      { label: 'Routing', to: '/routing', icon: Route },
      { label: 'Keys', to: '/keys', icon: KeyRound },
    ],
  },
  {
    label: 'Guardrails',
    phase: 3,
    items: [{ label: 'Policies', to: '/policies', icon: ShieldCheck }],
  },
  {
    label: 'Operate',
    phase: 4,
    items: [
      { label: 'Activity', to: '/activity', icon: Activity },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
]

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { pathname } = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { active: degradations, dismiss } = useDegradations()

  // A slow clock so the banner's "active for Xm" / cache-age stamps stay honest
  // without re-rendering the shell every second.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // The footer dot mirrors the banner: healthy until something is degraded,
  // then the worst active severity.
  const worst = worstSeverity(degradations)
  const footer =
    worst === null
      ? { dot: 'bg-success-foreground', text: 'Gateway healthy' }
      : worst === 'critical'
        ? { dot: 'bg-destructive-foreground', text: 'Gateway degraded' }
        : worst === 'warning'
          ? { dot: 'bg-warning-foreground', text: 'Gateway degraded' }
          : { dot: 'bg-info-foreground', text: 'Minor degradation' }

  return (
    <SidebarProvider>
      <div className="flex h-svh gap-2 bg-canvas p-2 text-foreground">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 px-1 py-1">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Waypoints className="size-4" />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold">Nebari</div>
                <div className="truncate text-xs text-muted-foreground">
                  Gateway Console
                </div>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            {SECTIONS.map((section) => (
              <SidebarGroup key={section.label}>
                <SidebarGroupLabel className="flex items-center justify-between">
                  {section.label}
                  {section.phase > 1 && (
                    <span className="text-[10px] font-normal text-muted-foreground">
                      Phase {section.phase}
                    </span>
                  )}
                </SidebarGroupLabel>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const live = section.phase === 1
                    const active = pathname === item.to
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          active={active}
                          disabled={!live}
                          aria-disabled={!live}
                          tooltip={live ? undefined : 'Coming in a later phase'}
                          render={
                            live ? (
                              <Link to={item.to} />
                            ) : (
                              <button type="button" />
                            )
                          }
                          className={cn(!live && 'cursor-not-allowed opacity-50')}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter>
            <div className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
              <span className={cn('inline-block size-2 rounded-full', footer.dot)} />
              {footer.text}
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-background shadow-xs">
          <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
            <SidebarTrigger />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold leading-tight">
                {title}
              </h1>
              {description && (
                <p className="truncate text-xs text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex">
              <span className="inline-block size-1.5 rounded-full bg-chart-1" />
              production
            </Badge>
            <Button
              aria-label="Open command palette"
              className="gap-2 text-muted-foreground"
              onClick={() => setPaletteOpen(true)}
              size="sm"
              variant="outline"
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-border px-1 text-[10px] sm:inline-block">
                ⌘K
              </kbd>
            </Button>
            <TimeRange />
            {actions}
          </header>
          <DegradationBanner
            degradations={degradations}
            now={now}
            onDismiss={dismiss}
          />
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </SidebarProvider>
  )
}
