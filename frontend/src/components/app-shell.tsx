import {
  Activity,
  DollarSign,
  KeyRound,
  LayoutDashboard,
  ListTree,
  Moon,
  Route,
  Search,
  Settings,
  ShieldCheck,
  Sun,
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  MenuBar,
  MenuBarActions,
  MenuBarBrand,
  MenuBarNav,
  NavLink,
} from '@/components/ui/navigation-menu'
import { Badge } from '@/components/ui/badge'
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

// Nebari's top-bar links, matching the pasted site SVG (Docs · Guides ·
// Reference). They point at the corresponding docs sections.
const NAV_LINKS = [
  { label: 'Docs', href: 'https://www.nebari.dev/docs' },
  { label: 'Guides', href: 'https://www.nebari.dev/docs/tutorials' },
  { label: 'Reference', href: 'https://www.nebari.dev/docs/references' },
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

  // Docs-site style theme toggle: flips the `dark` class the tokens key off.
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )
  function toggleTheme() {
    setDark((prev) => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light')
      } catch {
        // storage may be unavailable (private mode); the class still flips.
      }
      return next
    })
  }

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
      <div className="flex h-svh flex-col bg-canvas text-foreground">
        {/* Global top bar — the Nebari site chrome: colorful mark + wordmark on
            the left, muted external links, then a search field, GitHub, and a
            theme toggle on the right (matches nebari.dev's header). */}
        <MenuBar className="bg-header text-header-foreground">
          <MenuBarBrand href="/" className="gap-2 text-lg">
            <img src="/favicon.svg" alt="" aria-hidden className="size-7 shrink-0" />
            <span>Nebari</span>
            <span className="ml-1 hidden text-sm font-normal text-muted-foreground sm:inline">
              Gateway Console
            </span>
          </MenuBarBrand>
          {/* Nebari site nav: plain grey text links — no pill, no box, no
              arrows (matches the "Docs · Guides · Reference" bar in the SVG). */}
          <MenuBarNav className="ml-4 hidden gap-4 md:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.label}
                className="rounded-none px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                render={
                  <a href={link.href} target="_blank" rel="noreferrer" />
                }
              >
                {link.label}
              </NavLink>
            ))}
          </MenuBarNav>
          <MenuBarActions className="gap-2">
            {/* Looks like a docs-site search field; opens the ⌘K palette. */}
            <button
              type="button"
              aria-label="Open command palette"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex h-9 w-64 items-center gap-2 rounded-sm border border-border bg-card px-3 text-sm text-muted-foreground outline-none hover:border-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left">
                Search or ask a question…
              </span>
              <kbd className="shrink-0 rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                ⌘K
              </kbd>
            </button>
            <a
              href="https://github.com/nebari-dev/nebari"
              target="_blank"
              rel="noreferrer"
              aria-label="Nebari on GitHub"
              className="inline-flex size-9 items-center justify-center rounded-none text-foreground outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-opacity"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden
                className="size-5 fill-current"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex size-9 items-center justify-center rounded-none text-foreground outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-opacity"
            >
              {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </button>
          </MenuBarActions>
        </MenuBar>

        <div className="flex min-h-0 flex-1 gap-2 p-2">
          <Sidebar>
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
                            tooltip={
                              live ? undefined : 'Coming in a later phase'
                            }
                            render={
                              live ? (
                                <Link to={item.to} />
                              ) : (
                                <button type="button" />
                              )
                            }
                            // Docs-site active treatment: a purple left-edge bar
                            // (the registry's bg-muted highlight stays underneath).
                            className={cn(
                              'relative data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:left-0 data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-full data-[active=true]:before:bg-primary',
                              !live && 'cursor-not-allowed opacity-50',
                            )}
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
                <span
                  className={cn('inline-block size-2 rounded-full', footer.dot)}
                />
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
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </SidebarProvider>
  )
}
