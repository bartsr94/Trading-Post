// Starting backgrounds for the player-embodied 7th hero (POV_CHARACTER_SPEC.md
// §4.5). Picked once at chargen alongside name/gender/heritage/portrait/stats;
// each grants an epithet, a trait or two, and the opening `history` line —
// small, flavor-only starting points, not a branching prologue tree.

import type { TraitId } from '../engine/types';

export interface POVBackgroundDef {
  id: string;
  label: string;
  epithet: string;
  description: string;
  traits: TraitId[];
  openingHistory: string;
}

export const POV_BACKGROUNDS: POVBackgroundDef[] = [
  {
    id: 'company_factor',
    label: 'Company-Trained Factor',
    epithet: 'the Factor',
    description:
      'Years spent behind an Ansberry Company ledger, sent out at last to make the numbers work in a place that has never heard of them.',
    traits: ['silver_tongued'],
    openingHistory: "Arrived from the Company's counting houses to found the post.",
  },
  {
    id: 'frontier_born',
    label: 'Frontier-Born',
    epithet: 'the Frontier-Born',
    description:
      'Grew up on the edge of the map, more at home in the wild than in any Company office back in the homeland.',
    traits: ['wanderer'],
    openingHistory: 'Grew up on the frontier long before the Company staked a claim here.',
  },
  {
    id: 'disgraced_noble',
    label: 'Disgraced Noble',
    epithet: 'the Disgraced',
    description:
      'A homeland name that opens fewer doors than it once did. The Ashmark is a place to rebuild it — or disappear.',
    traits: ['iron_willed'],
    openingHistory: 'Left the homeland under a cloud, with a name to rebuild.',
  },
  {
    id: 'veteran_officer',
    label: 'Veteran Officer',
    epithet: 'the Veteran',
    description:
      'Cut their teeth commanding auxiliaries against the Cult of the Black Sun. Knows how to hold a line when one is needed.',
    traits: ['brave'],
    openingHistory: 'Left military service behind to found the post.',
  },
  {
    id: 'river_go_between',
    label: 'River-Town Go-Between',
    epithet: 'the Go-Between',
    description:
      'Grew up moving between homeland boats and native river towns, fluent in both worlds and fully trusted by neither.',
    traits: ['kindhearted'],
    openingHistory: 'Grew up between homeland and river-town life, at home in both and neither.',
  },
];
