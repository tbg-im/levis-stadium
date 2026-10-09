'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { CameraControls } from '@react-three/drei';
import {
  ArmchairIcon,
  Building2Icon,
  CompassIcon,
  EyeIcon,
  HomeIcon,
  MinusIcon,
  Navigation2Icon,
  PlusIcon,
  RotateCcwIcon,
  RotateCwIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { ALL_SECTIONS, LEVELS, MODELED_SEATS, SEAT_TOTALS } from '@/lib/stadium/bowl';
import { FIELD_BEARING_DEG, STADIUM_FACTS } from '@/lib/stadium/dimensions';
import { LANDMARKS } from '@/lib/stadium/site';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { LevelFilter } from './Bowl';
import Scene, { VIEWS, type ScreenLabel, type ViewName } from './Scene';

const fmt = new Intl.NumberFormat('en-US');
const ft = (m: number) => `${fmt.format(Math.round(m * 3.281))} ft`;

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <Card className={`pointer-events-auto flex-row items-center gap-3 px-4 py-3 shadow-md ${className ?? ''}`}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-500">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums leading-tight">{value}</div>
        <div className="truncate text-xs text-muted-foreground">{detail}</div>
      </div>
    </Card>
  );
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

export default function StadiumViewer() {
  const controlsRef = useRef<CameraControls | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [showSurroundings, setShowSurroundings] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [view, setView] = useState<ViewName>('overview');
  const [azimuth, setAzimuth] = useState(0);

  const selected = useMemo(() => ALL_SECTIONS.find((s) => s.key === selectedKey) ?? null, [selectedKey]);
  const selectedLevel = selected ? LEVELS.find((l) => l.id === selected.level)! : null;
  const hovered = useMemo(
    () => (hoveredKey && hoveredKey !== selectedKey ? ALL_SECTIONS.find((s) => s.key === hoveredKey) ?? null : null),
    [hoveredKey, selectedKey],
  );

  const labelElements = useRef(new Map<string, HTMLElement>());
  const landmarks = showLabels && showSurroundings ? LANDMARKS : [];
  const markers = [selected, hovered].filter((s) => s !== null);
  const labels = useMemo<ScreenLabel[]>(
    () => [
      ...landmarks,
      ...markers.map((s) => ({ id: s.key, position: [s.center[0], s.center[1] + 6, s.center[2]] as [number, number, number] })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [landmarks, selected, hovered],
  );
  const bindLabel = (id: string) => (el: HTMLElement | null) => {
    if (el) labelElements.current.set(id, el);
    else labelElements.current.delete(id);
  };

  const goTo = useCallback((name: ViewName) => {
    const v = VIEWS[name];
    setView(name);
    controlsRef.current?.setLookAt(...(v.position as [number, number, number]), ...(v.target as [number, number, number]), true);
  }, []);

  const viewFromSection = useCallback(() => {
    if (!selected) return;
    const [x, y, z] = selected.center;
    const back = 1.04;
    controlsRef.current?.setLookAt(x * back, y + 1.3, z * back, 0, 1, 0, true);
  }, [selected]);

  const onAzimuth = useCallback((a: number) => {
    setAzimuth((prev) => (Math.abs(prev - a) > 0.004 ? a : prev));
  }, []);

  // Screen angle of true north: the field's north end is at bearing FIELD_BEARING_DEG.
  const northDeg = 360 - FIELD_BEARING_DEG + (azimuth * 180) / Math.PI;

  return (
    <TooltipProvider>
      <div className="relative h-dvh w-full overflow-hidden bg-background">
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          camera={{ fov: 30, near: 1, far: 9000, position: VIEWS.overview.position as unknown as [number, number, number] }}
          onCreated={({ camera }) => camera.lookAt(0, 8, 0)}
          onPointerMissed={() => setHoveredKey(null)}
        >
          <Scene
            controlsRef={controlsRef}
            selectedKey={selectedKey}
            hoveredKey={hoveredKey}
            levelFilter={levelFilter}
            showSurroundings={showSurroundings}
            onHover={setHoveredKey}
            onSelect={setSelectedKey}
            onAzimuth={onAzimuth}
            labels={labels}
            labelElements={labelElements}
          />
        </Canvas>

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {landmarks.map((l) => (
            <div key={l.id} ref={bindLabel(l.id)} className="invisible absolute left-0 top-0">
              <div className="whitespace-nowrap rounded-full border border-border bg-card/90 px-2.5 py-1 text-xs font-medium text-card-foreground shadow-sm backdrop-blur">
                {l.name}
              </div>
            </div>
          ))}
          {markers.map((s) => {
            const level = LEVELS.find((l) => l.id === s.level)!;
            const isSelected = s.key === selectedKey;
            return (
              <div key={s.key} ref={bindLabel(s.key)} className="invisible absolute left-0 top-0 flex flex-col items-center">
                <div
                  className={
                    isSelected
                      ? 'flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground shadow-md'
                      : 'flex items-center gap-1.5 whitespace-nowrap rounded-md bg-card px-2 py-1 text-xs font-semibold text-card-foreground shadow-md'
                  }
                >
                  <span>Sec {s.number}</span>
                  <span className="font-normal opacity-80">{level.label}</span>
                </div>
                <div className={isSelected ? 'h-3 w-px bg-primary' : 'h-3 w-px bg-border'} />
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-3 p-3 md:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <StatCard
                icon={UsersIcon}
                label="Capacity"
                value={fmt.format(STADIUM_FACTS.capacity)}
                detail={`Expands to ${fmt.format(STADIUM_FACTS.expandedCapacity)}`}
              />
              <StatCard
                icon={ArmchairIcon}
                label="Seats modeled"
                value={fmt.format(MODELED_SEATS)}
                detail={`${ALL_SECTIONS.length} sections, placed seat by seat`}
                className="hidden sm:flex"
              />
              <StatCard
                icon={Building2Icon}
                label="Suite tower"
                value={`${STADIUM_FACTS.towerHeight} m`}
                detail={`${STADIUM_FACTS.towerLevels} levels · ${STADIUM_FACTS.suites} suites`}
                className="hidden lg:flex"
              />
            </div>

            <div className="flex items-start gap-3">
              {selected && selectedLevel && (
                <Card className="pointer-events-auto hidden w-80 gap-0 py-0 shadow-lg md:flex">
                  <div className="flex items-start justify-between gap-2 p-4 pb-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {selectedLevel.label} · {selectedLevel.short}
                      </div>
                      <div className="text-lg font-semibold">Section {selected.number}</div>
                      <div className="text-sm text-muted-foreground">{selected.side}</div>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Close section" onClick={() => setSelectedKey(null)}>
                      <XIcon />
                    </Button>
                  </div>
                  <div className="px-4">
                    <Badge variant="secondary">{selected.exposure}</Badge>
                  </div>
                  <div className="px-4 pt-2">
                    <Detail label="Seats" value={fmt.format(selected.seats)} />
                    <Detail label="Rows" value={`1–${selected.rows}`} />
                    <Detail label="Front row" value={`${ft(selected.frontY)} above field`} />
                    <Detail label="Back row" value={`${ft(selected.topY)} above field`} />
                    <Detail label="To midfield" value={`${fmt.format(Math.round(selected.distanceToMidfield / 0.9144))} yd`} />
                  </div>
                  <Separator className="mt-2" />
                  <div className="p-3">
                    <Button className="w-full" onClick={viewFromSection}>
                      <EyeIcon />
                      View from this section
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="pointer-events-auto gap-0 p-1 shadow-md">
                <ControlButton label="Zoom in" onClick={() => controlsRef.current?.dolly(controlsRef.current.distance * 0.35, true)}>
                  <PlusIcon />
                </ControlButton>
                <ControlButton label="Zoom out" onClick={() => controlsRef.current?.dolly(-controlsRef.current.distance * 0.5, true)}>
                  <MinusIcon />
                </ControlButton>
                <Separator className="my-1" />
                <ControlButton label="Rotate left" onClick={() => controlsRef.current?.rotate(-Math.PI / 4, 0, true)}>
                  <RotateCcwIcon />
                </ControlButton>
                <ControlButton label="Rotate right" onClick={() => controlsRef.current?.rotate(Math.PI / 4, 0, true)}>
                  <RotateCwIcon />
                </ControlButton>
                <Separator className="my-1" />
                <ControlButton label="Reset view" onClick={() => goTo('overview')}>
                  <HomeIcon />
                </ControlButton>
              </Card>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <Card className="pointer-events-auto w-full gap-3 px-4 py-3 shadow-md sm:w-auto">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ArmchairIcon className="size-4 text-primary" />
                  Seating levels
                </div>
                <span className="text-xs text-muted-foreground">Click a section for details</span>
              </div>
              <Tabs value={levelFilter} onValueChange={(v) => setLevelFilter(v as LevelFilter)}>
                <TabsList className="w-full">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {LEVELS.map((l) => (
                    <TabsTrigger key={l.id} value={l.id}>
                      {l.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="grid grid-cols-3 gap-3">
                {SEAT_TOTALS.map((l) => (
                  <div key={l.id} className="min-w-0">
                    <div className="text-xs text-muted-foreground">{l.short}</div>
                    <div className="text-sm font-semibold tabular-nums">{fmt.format(l.seats)}</div>
                    <div className="text-xs text-muted-foreground">{l.sections} sections</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="pointer-events-auto w-full gap-3 px-4 py-3 shadow-md sm:w-auto">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CompassIcon className="size-4 text-primary" />
                  Views
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="True north">
                  <Navigation2Icon className="size-3.5 text-primary transition-transform" style={{ transform: `rotate(${northDeg}deg)` }} />
                  N
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(VIEWS) as ViewName[]).map((name) => (
                  <Button key={name} size="sm" variant={view === name ? 'default' : 'outline'} onClick={() => goTo(name)}>
                    {VIEWS[name].label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <Switch id="surroundings" checked={showSurroundings} onCheckedChange={setShowSurroundings} />
                  <Label htmlFor="surroundings" className="text-xs">
                    Surroundings
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="labels" checked={showLabels} onCheckedChange={setShowLabels} disabled={!showSurroundings} />
                  <Label htmlFor="labels" className="text-xs">
                    Labels
                  </Label>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">Map data © OpenStreetMap</span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
