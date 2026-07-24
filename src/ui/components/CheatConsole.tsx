// The cheat console (testing tool, off by default — see SettingsMenu). A
// thin UI layer over the same Outcome vocabulary every event already uses:
// every "apply" button below builds an Outcome[] and hands it to the store's
// applyCheatOutcomes, which runs it through the real engine applyOutcomes.
// Forcing an event reuses resolveChoice via the store's forceFireEvent. No
// engine code changes; this file is content-aware like any other screen.

import { useState } from 'react';
import { BUILDINGS } from '../../content/buildings';
import { ALL_EVENTS } from '../../content/events';
import { FACTION_NAMES } from '../../content/factions';
import { GOOD_NAMES } from '../../content/goods';
import { LOCATION_NAMES } from '../../content/locations';
import { RECRUITS } from '../../content/recruits';
import { TRAIT_NAMES } from '../../content/traits';
import { canWed, graphNode, isMarried, marriageableKin, spousesOf } from '../../engine/family';
import {
  DISCOVERY_STATES,
  FACTION_IDS,
  GOOD_IDS,
  HERITAGES,
  RAID_SEVERITIES,
  RESIDENT_ROLES,
  TRANSIENT_KINDS,
  heritageGroup,
  livingHeroes,
} from '../../engine/types';
import type {
  AxisId,
  DiscoveryState,
  FactionId,
  GameState,
  GoodId,
  Heritage,
  HeritageGroup,
  RaidSeverity,
  ResidentRole,
  TransientKind,
  UnionSource,
} from '../../engine/types';
import type { Outcome } from '../../engine/events/types';
import { useGameStore } from '../../store/gameStore';

const AXES: { id: AxisId; label: string }[] = [
  { id: 'integration', label: 'Integration (Aloof ↔ Integrated)' },
  { id: 'communal', label: 'Communal (Mercantile ↔ Communal)' },
  { id: 'culture', label: 'Culture (Homeland ↔ Frontier)' },
];

const TRANSIENT_LABELS: Record<TransientKind, string> = {
  visitorGuards: 'Visitor Guards',
  companyAgents: 'Company Agents',
  supplierCrew: 'Supplier Crew',
  beastfolkVisitors: 'Beastfolk Visitors',
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function CheatConsole({ game, onClose }: { game: GameState; onClose: () => void }) {
  const applyOutcomes = useGameStore((s) => s.applyCheatOutcomes);
  const forceFireEvent = useGameStore((s) => s.forceFireEvent);
  const setCheatConsoleOpen = useGameStore((s) => s.setCheatConsoleOpen);

  const heroes = livingHeroes(game);
  const [actingHeroId, setActingHeroId] = useState(heroes[0]?.id ?? '');
  const [log, setLog] = useState<string[] | null>(null);

  const apply = (outcomes: Outcome[]) => {
    if (!actingHeroId) return;
    setLog(applyOutcomes(outcomes, actingHeroId));
  };

  if (heroes.length === 0) {
    return (
      <div className="ft-overlay" onClick={onClose}>
        <div className="ft-modal cc-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ft-header">
            <h3 style={{ margin: 0 }}>Cheat Console</h3>
            <button className="small" onClick={onClose}>Close</button>
          </div>
          <div className="ft-canvas">
            <p className="dim">No living characters — hero-dependent cheats need at least one.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ft-overlay" onClick={onClose}>
      <div className="ft-modal cc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ft-header">
          <h3 style={{ margin: 0 }}>Cheat Console</h3>
          <button className="small" onClick={onClose}>Close</button>
        </div>
        <div className="ft-canvas cc-canvas">
          <label className="dim" style={{ display: 'block', marginBottom: 10 }}>
            Acting hero (context for hero-targeted actions below)
            <select
              value={actingHeroId}
              onChange={(e) => setActingHeroId(e.target.value)}
              style={{ marginLeft: 8 }}
            >
              {heroes.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </label>

          {log && (
            <div className="panel" style={{ marginBottom: 10 }}>
              <div className="dim" style={{ fontSize: '0.8rem' }}>
                {log.length > 0 ? log.join(' · ') : '(no effect)'}
              </div>
            </div>
          )}

          <div className="cc-grid">
            <EconomySection apply={apply} game={game} />
            <StandingSection apply={apply} />
            <AxesSection apply={apply} />
            <HeroSection apply={apply} actingHeroName={graphNode(game, actingHeroId)?.name ?? ''} />
            <ResidentsSection apply={apply} />
            <ThrallsSection apply={apply} />
            <BuildingsSection apply={apply} />
            <RosterSection apply={apply} heroes={heroes} />
            <FamilySection apply={apply} game={game} />
            <WorldSection apply={apply} game={game} />
            <RaidSection apply={apply} onTriggered={() => setCheatConsoleOpen(false)} />
            <ForceEventSection
              heroes={heroes}
              onForce={(eventId, heroId) => {
                if (forceFireEvent(eventId, heroId)) {
                  setCheatConsoleOpen(false);
                } else {
                  setLog(['Could not force that event (unknown id, travel event, or invalid hero).']);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ sections

function NumField({
  value,
  onChange,
  width = 70,
}: {
  value: number;
  onChange: (v: number) => void;
  width?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Math.floor(Number(e.target.value) || 0))}
      style={{ width }}
    />
  );
}

function EconomySection({ apply, game }: { apply: (o: Outcome[]) => void; game: GameState }) {
  const [silverDelta, setSilverDelta] = useState(100);
  const [good, setGood] = useState<GoodId>(GOOD_IDS[0]);
  const [goodDelta, setGoodDelta] = useState(10);
  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Economy</h4>
      <div className="cc-row">
        Silver <NumField value={silverDelta} onChange={setSilverDelta} />
        <button className="small" onClick={() => apply([{ type: 'silver', delta: silverDelta }])}>
          Apply
        </button>
      </div>
      <div className="cc-row">
        <select value={good} onChange={(e) => setGood(e.target.value as GoodId)}>
          {GOOD_IDS.map((g) => (
            <option key={g} value={g}>{GOOD_NAMES.get(g) ?? g}</option>
          ))}
        </select>
        <NumField value={goodDelta} onChange={setGoodDelta} />
        <button className="small" onClick={() => apply([{ type: 'good', good, delta: goodDelta }])}>
          Apply
        </button>
      </div>
      <div className="dim" style={{ fontSize: '0.75rem' }}>
        Post holds {game.silver} silver.
      </div>
    </div>
  );
}

function StandingSection({ apply }: { apply: (o: Outcome[]) => void }) {
  const [faction, setFaction] = useState<FactionId>(FACTION_IDS[0]);
  const [delta, setDelta] = useState(10);
  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Standing</h4>
      <div className="cc-row">
        <select value={faction} onChange={(e) => setFaction(e.target.value as FactionId)}>
          {FACTION_IDS.map((f) => (
            <option key={f} value={f}>{FACTION_NAMES.get(f) ?? f}</option>
          ))}
        </select>
        <NumField value={delta} onChange={setDelta} />
        <button className="small" onClick={() => apply([{ type: 'standing', faction, delta }])}>
          Apply
        </button>
      </div>
    </div>
  );
}

function AxesSection({ apply }: { apply: (o: Outcome[]) => void }) {
  const [axis, setAxis] = useState<AxisId>('integration');
  const [delta, setDelta] = useState(2);
  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Axes</h4>
      <div className="cc-row">
        <select value={axis} onChange={(e) => setAxis(e.target.value as AxisId)}>
          {AXES.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        <NumField value={delta} onChange={setDelta} />
        <button className="small" onClick={() => apply([{ type: 'axis', axis, delta }])}>
          Apply
        </button>
      </div>
    </div>
  );
}

function HeroSection({
  apply,
  actingHeroName,
}: {
  apply: (o: Outcome[]) => void;
  actingHeroName: string;
}) {
  const [trait, setTrait] = useState(() => [...TRAIT_NAMES.keys()][0] ?? '');
  const [healthDelta, setHealthDelta] = useState(-3);
  const [stressDelta, setStressDelta] = useState(3);
  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Hero — {actingHeroName}</h4>
      <div className="cc-row">
        <select value={trait} onChange={(e) => setTrait(e.target.value)}>
          {[...TRAIT_NAMES.entries()].map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <button className="small" onClick={() => apply([{ type: 'addTrait', trait }])}>
          Add
        </button>
        <button className="small" onClick={() => apply([{ type: 'removeTrait', trait }])}>
          Remove
        </button>
      </div>
      <div className="cc-row">
        Health <NumField value={healthDelta} onChange={setHealthDelta} />
        <button className="small" onClick={() => apply([{ type: 'health', delta: healthDelta }])}>
          Apply
        </button>
      </div>
      <div className="cc-row">
        Stress <NumField value={stressDelta} onChange={setStressDelta} />
        <button className="small" onClick={() => apply([{ type: 'stress', delta: stressDelta }])}>
          Apply
        </button>
      </div>
      <button className="small" onClick={() => apply([{ type: 'heroDeparts' }])}>
        Departs the Company
      </button>
    </div>
  );
}

function ResidentsSection({ apply }: { apply: (o: Outcome[]) => void }) {
  const [role, setRole] = useState<ResidentRole>(RESIDENT_ROLES[0]);
  const [count, setCount] = useState(5);
  const [group, setGroup] = useState<HeritageGroup | ''>('');
  const [heritage, setHeritage] = useState<Heritage | ''>('');
  const [contentDelta, setContentDelta] = useState(2);
  const [transientKind, setTransientKind] = useState<TransientKind>(TRANSIENT_KINDS[0]);
  const [transientCount, setTransientCount] = useState(3);
  const [transientTurns, setTransientTurns] = useState(4);

  // A heritage pick (e.g. 'orc'/'goblin') tags the resident with that heritage
  // and defaults their origin bucket from it — the manual origin dropdown
  // below still wins if explicitly set, for testing mismatched cases.
  const resolvedGroup = group || (heritage ? heritageGroup(heritage) : undefined);

  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Residents</h4>
      <div className="cc-row">
        <select value={role} onChange={(e) => setRole(e.target.value as ResidentRole)}>
          {RESIDENT_ROLES.map((r) => (
            <option key={r} value={r}>{cap(r)}</option>
          ))}
        </select>
        <NumField value={count} onChange={setCount} width={55} />
        <select value={heritage} onChange={(e) => setHeritage(e.target.value as Heritage | '')}>
          <option value="">no heritage tag</option>
          {HERITAGES.map((h) => (
            <option key={h} value={h}>{cap(h)}</option>
          ))}
        </select>
        <select value={group} onChange={(e) => setGroup(e.target.value as HeritageGroup | '')}>
          <option value="">
            {heritage ? `origin: ${resolvedGroup}` : 'any origin'}
          </option>
          <option value="homeland">homeland</option>
          <option value="native">native</option>
        </select>
        <button
          className="small"
          onClick={() =>
            apply([
              { type: 'addResidents', role, count, tag: heritage || undefined, group: resolvedGroup },
            ])
          }
        >
          Add
        </button>
        <button
          className="small"
          onClick={() => apply([{ type: 'loseResidents', role, count, group: resolvedGroup }])}
        >
          Lose
        </button>
      </div>
      <div className="cc-row">
        Contentment <NumField value={contentDelta} onChange={setContentDelta} />
        <button className="small" onClick={() => apply([{ type: 'contentment', delta: contentDelta }])}>
          Apply
        </button>
      </div>
      <div className="cc-row">
        <select value={transientKind} onChange={(e) => setTransientKind(e.target.value as TransientKind)}>
          {TRANSIENT_KINDS.map((k) => (
            <option key={k} value={k}>{TRANSIENT_LABELS[k]}</option>
          ))}
        </select>
        <NumField value={transientCount} onChange={setTransientCount} width={50} />
        turns <NumField value={transientTurns} onChange={setTransientTurns} width={50} />
        <button
          className="small"
          onClick={() =>
            apply([
              { type: 'addTransient', kind: transientKind, count: transientCount, turns: transientTurns },
            ])
          }
        >
          Add
        </button>
      </div>
    </div>
  );
}

function ThrallsSection({ apply }: { apply: (o: Outcome[]) => void }) {
  const [role, setRole] = useState<ResidentRole | 'idle'>('idle');
  const [count, setCount] = useState(3);
  const [heritage, setHeritage] = useState<Heritage | ''>('');
  const [group, setGroup] = useState<HeritageGroup | ''>('');
  const [restivenessDelta, setRestivenessDelta] = useState(3);

  const resolvedGroup = group || (heritage ? heritageGroup(heritage) : undefined);
  const roles: (ResidentRole | 'idle')[] = ['idle', ...RESIDENT_ROLES.filter((r) => r !== 'guards')];

  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Thralls</h4>
      <div className="cc-row">
        <select value={role} onChange={(e) => setRole(e.target.value as ResidentRole | 'idle')}>
          {roles.map((r) => (
            <option key={r} value={r}>{cap(r)}</option>
          ))}
        </select>
        <NumField value={count} onChange={setCount} width={55} />
        <select value={heritage} onChange={(e) => setHeritage(e.target.value as Heritage | '')}>
          <option value="">no heritage tag</option>
          {HERITAGES.map((h) => (
            <option key={h} value={h}>{cap(h)}</option>
          ))}
        </select>
        <select value={group} onChange={(e) => setGroup(e.target.value as HeritageGroup | '')}>
          <option value="">
            {heritage ? `origin: ${resolvedGroup}` : 'any origin'}
          </option>
          <option value="homeland">homeland</option>
          <option value="native">native</option>
        </select>
        <button
          className="small"
          onClick={() =>
            apply([
              { type: 'addThralls', role, count, tag: heritage || undefined, group: resolvedGroup },
            ])
          }
        >
          Add
        </button>
        <button
          className="small"
          onClick={() =>
            apply([{ type: 'loseThralls', role: role === 'idle' ? undefined : role, count, group: resolvedGroup }])
          }
        >
          Lose
        </button>
      </div>
      <div className="cc-row">
        Restiveness <NumField value={restivenessDelta} onChange={setRestivenessDelta} />
        <button className="small" onClick={() => apply([{ type: 'thrallRestiveness', delta: restivenessDelta }])}>
          Apply
        </button>
      </div>
    </div>
  );
}

function BuildingsSection({ apply }: { apply: (o: Outcome[]) => void }) {
  const [building, setBuilding] = useState(BUILDINGS[0]?.id ?? '');
  const [progressDelta, setProgressDelta] = useState(10);
  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Buildings</h4>
      <div className="cc-row">
        <select value={building} onChange={(e) => setBuilding(e.target.value)}>
          {BUILDINGS.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <button className="small" onClick={() => apply([{ type: 'completeBuilding', building }])}>
          Complete Instantly
        </button>
      </div>
      <div className="cc-row">
        Progress <NumField value={progressDelta} onChange={setProgressDelta} />
        <button className="small" onClick={() => apply([{ type: 'addBuildProgress', delta: progressDelta }])}>
          Apply
        </button>
      </div>
      <button className="small" onClick={() => apply([{ type: 'advanceTier' }])}>
        Advance Tier
      </button>
    </div>
  );
}

function RosterSection({
  apply,
  heroes,
}: {
  apply: (o: Outcome[]) => void;
  heroes: { id: string; name: string }[];
}) {
  const [templateId, setTemplateId] = useState(RECRUITS[0]?.id ?? '');
  const [toActive, setToActive] = useState(false);
  const [departId, setDepartId] = useState(heroes[0]?.id ?? '');
  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Roster</h4>
      <div className="cc-row">
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {RECRUITS.map((r) => (
            <option key={r.id} value={r.id}>{r.name}, {r.epithet}</option>
          ))}
        </select>
        <label className="dim" style={{ fontSize: '0.78rem' }}>
          <input type="checkbox" checked={toActive} onChange={(e) => setToActive(e.target.checked)} />{' '}
          to active
        </label>
        <button
          className="small"
          onClick={() => apply([{ type: 'recruitCharacter', templateId, toActive }])}
        >
          Recruit
        </button>
      </div>
      <div className="cc-row">
        <select value={departId} onChange={(e) => setDepartId(e.target.value)}>
          {heroes.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        <button className="small" onClick={() => apply([{ type: 'departCharacter', heroId: departId }])}>
          Depart
        </button>
      </div>
    </div>
  );
}

function FamilySection({ apply, game }: { apply: (o: Outcome[]) => void; game: GameState }) {
  const marriageCandidates = [
    ...livingHeroes(game).filter((h) => canWed(game, h.id)),
    ...marriageableKin(game),
  ];
  const birthCandidates = [
    ...livingHeroes(game).filter((h) => isMarried(game, h.id)),
    ...game.dependants.filter((d) => d.kind === 'kin' && d.comeOfAge && isMarried(game, d.id)),
  ];
  const children = game.dependants.filter((d) => d.kind === 'child' && !d.comeOfAge);

  const heroMarriageCandidates = livingHeroes(game).filter((h) => canWed(game, h.id));

  const [subjectId, setSubjectId] = useState(marriageCandidates[0]?.id ?? '');
  const [source, setSource] = useState<UnionSource>('informal');
  const [heritage, setHeritage] = useState<Heritage>(HERITAGES[0]);
  const [heroAId, setHeroAId] = useState(heroMarriageCandidates[0]?.id ?? '');
  const [heroBId, setHeroBId] = useState(
    heroMarriageCandidates[1]?.id ?? heroMarriageCandidates[0]?.id ?? '',
  );
  const [birthSubjectId, setBirthSubjectId] = useState(birthCandidates[0]?.id ?? '');
  const spouseCandidates = birthSubjectId ? spousesOf(game, birthSubjectId) : [];
  const [otherParentId, setOtherParentId] = useState(spouseCandidates[0]?.id ?? '');
  const [childId, setChildId] = useState(children[0]?.id ?? '');

  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Family</h4>
      {marriageCandidates.length > 0 ? (
        <div className="cc-row">
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {marriageCandidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value as UnionSource)}>
            <option value="homeland">homeland</option>
            <option value="alliance">alliance</option>
            <option value="informal">informal</option>
          </select>
          <select value={heritage} onChange={(e) => setHeritage(e.target.value as Heritage)}>
            {HERITAGES.map((h) => (
              <option key={h} value={h}>{cap(h)}</option>
            ))}
          </select>
          <button
            className="small"
            onClick={() => apply([{ type: 'formUnion', subjectId, source, heritage }])}
          >
            Force Marriage
          </button>
        </div>
      ) : (
        <p className="dim" style={{ fontSize: '0.78rem' }}>No one eligible to wed right now.</p>
      )}
      {heroMarriageCandidates.length > 1 ? (
        <div className="cc-row">
          <select value={heroAId} onChange={(e) => setHeroAId(e.target.value)}>
            {heroMarriageCandidates.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <select value={heroBId} onChange={(e) => setHeroBId(e.target.value)}>
            {heroMarriageCandidates.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <button
            className="small"
            disabled={heroAId === heroBId}
            title={heroAId === heroBId ? 'Pick two different heroes' : undefined}
            onClick={() => apply([{ type: 'formHeroUnion', subjectId: heroAId, partnerId: heroBId }])}
          >
            Force Hero-Hero Marriage
          </button>
        </div>
      ) : (
        <p className="dim" style={{ fontSize: '0.78rem' }}>Need two eligible heroes to wed each other.</p>
      )}
      {birthCandidates.length > 0 ? (
        <div className="cc-row">
          <select
            value={birthSubjectId}
            onChange={(e) => {
              const nextId = e.target.value;
              setBirthSubjectId(nextId);
              setOtherParentId(spousesOf(game, nextId)[0]?.id ?? '');
            }}
          >
            {birthCandidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {spouseCandidates.length > 1 && (
            <select value={otherParentId} onChange={(e) => setOtherParentId(e.target.value)}>
              {spouseCandidates.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <button
            className="small"
            onClick={() =>
              apply([
                { type: 'addDependant', kind: 'child', parentId: birthSubjectId, otherParentId },
              ])
            }
          >
            Force Birth
          </button>
        </div>
      ) : (
        <p className="dim" style={{ fontSize: '0.78rem' }}>No married couples to bear a child yet.</p>
      )}
      {children.length > 0 && (
        <div className="cc-row">
          <select value={childId} onChange={(e) => setChildId(e.target.value)}>
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="small" onClick={() => apply([{ type: 'comeOfAge', dependantId: childId }])}>
            Come of Age
          </button>
        </div>
      )}
    </div>
  );
}

function WorldSection({ apply, game }: { apply: (o: Outcome[]) => void; game: GameState }) {
  const [flag, setFlag] = useState('');
  const locationIds = Object.keys(game.locations);
  const [location, setLocation] = useState(locationIds[0] ?? '');
  const [discovery, setDiscovery] = useState<DiscoveryState>('known');
  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>World</h4>
      <div className="cc-row">
        <input
          type="text"
          placeholder="flag name"
          value={flag}
          onChange={(e) => setFlag(e.target.value)}
          style={{ width: 140 }}
        />
        <button className="small" disabled={!flag} onClick={() => apply([{ type: 'setFlag', flag, value: true }])}>
          Set
        </button>
        <button className="small" disabled={!flag} onClick={() => apply([{ type: 'setFlag', flag, value: false }])}>
          Clear
        </button>
      </div>
      <div className="cc-row">
        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          {locationIds.map((id) => (
            <option key={id} value={id}>{LOCATION_NAMES.get(id) ?? id}</option>
          ))}
        </select>
        <select value={discovery} onChange={(e) => setDiscovery(e.target.value as DiscoveryState)}>
          {DISCOVERY_STATES.map((d) => (
            <option key={d} value={d}>{cap(d)}</option>
          ))}
        </select>
        <button className="small" onClick={() => apply([{ type: 'discover', location, to: discovery }])}>
          Set
        </button>
      </div>
    </div>
  );
}

function RaidSection({
  apply,
  onTriggered,
}: {
  apply: (o: Outcome[]) => void;
  onTriggered: () => void;
}) {
  const [faction, setFaction] = useState<FactionId>('BEASTFOLK');
  const [severity, setSeverity] = useState<RaidSeverity>('raid');
  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Raid</h4>
      <div className="cc-row">
        <select value={faction} onChange={(e) => setFaction(e.target.value as FactionId)}>
          {FACTION_IDS.filter((f) => f !== 'CHARTER_COMPANY').map((f) => (
            <option key={f} value={f}>{FACTION_NAMES.get(f) ?? f}</option>
          ))}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value as RaidSeverity)}>
          {RAID_SEVERITIES.map((s) => (
            <option key={s} value={s}>{cap(s)}</option>
          ))}
        </select>
        <button
          className="small"
          onClick={() => {
            apply([{ type: 'startRaid', faction, severity }]);
            onTriggered();
          }}
        >
          Send Raiders
        </button>
      </div>
      <p className="dim" style={{ fontSize: '0.72rem' }}>
        Queues an incoming raid and closes the console so the defence modal shows.
      </p>
    </div>
  );
}

function ForceEventSection({
  heroes,
  onForce,
}: {
  heroes: { id: string; name: string }[];
  onForce: (eventId: string, heroId: string) => void;
}) {
  const eligible = ALL_EVENTS.filter((e) => e.category !== 'travel');
  const [eventId, setEventId] = useState(eligible[0]?.id ?? '');
  const [heroId, setHeroId] = useState(heroes[0]?.id ?? '');
  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Force Event</h4>
      <div className="cc-row">
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ maxWidth: 220 }}>
          {eligible.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        <select value={heroId} onChange={(e) => setHeroId(e.target.value)}>
          {heroes.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        <button className="small" onClick={() => onForce(eventId, heroId)}>
          Fire Now
        </button>
      </div>
      <p className="dim" style={{ fontSize: '0.72rem' }}>
        Bypasses conditions, cooldowns, and `once` bookkeeping — for content testing only.
      </p>
    </div>
  );
}
