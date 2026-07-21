// Name pools for dependants (spouses, children, kin) — Ashmark-flavored by
// heritage and gender per docs/ASHMARK_LORE_SPEC.md. The engine never hard-codes
// names; it asks for one via `dependantName`, injected through TurnContext, and
// picks deterministically by a seed (a dependant-id counter) so saves replay.

import type { Gender, Heritage } from '../engine/types';

type Pools = Record<Heritage, Record<Gender, string[]>>;

const NAMES: Pools = {
  imanian: {
    male: ['Aldric', 'Bern', 'Cael', 'Doran', 'Emric', 'Garrin', 'Loris', 'Ottar', 'Renn', 'Selwyn'],
    female: ['Ada', 'Brisa', 'Elin', 'Halla', 'Isaura', 'Lys', 'Marga', 'Norwen', 'Sabine', 'Wyn'],
  },
  kiswani: {
    male: ['Abasi', 'Chiro', 'Dawit', 'Jelani', 'Kofi', 'Njoro', 'Simba', 'Tumo', 'Zuberi', 'Baraka'],
    female: ['Amara', 'Chuma', 'Dalila', 'Imani', 'Kesi', 'Nia', 'Sela', 'Themba', 'Zola', 'Ashaki'],
  },
  hanjoda: {
    male: ['Baturu', 'Erke', 'Ganta', 'Khenbish', 'Mergen', 'Naranbat', 'Sube', 'Temujin', 'Yesugei', 'Chuluun'],
    female: ['Altani', 'Bolormaa', 'Enkhee', 'Khulan', 'Nomin', 'Oyuun', 'Saran', 'Tuya', 'Uranchimeg', 'Yesui'],
  },
  weri: {
    male: ['Bathar', 'Dokrun', 'Garruk', 'Hedrol', 'Korgan', 'Molvan', 'Rurmok', 'Thagan', 'Voldar', 'Zurmek'],
    female: ['Brunna', 'Dagrun', 'Halmka', 'Korra', 'Molgra', 'Nurvi', 'Rathka', 'Torgna', 'Velka', 'Yurna'],
  },
  orc: {
    // Rare among orcs themselves (BEASTFOLK_SPEC.md) — mostly heard as the name
    // of a captured-and-kept or wed-in outsider, or a war-band's few sons.
    male: ['Ashgor', 'Brakk', 'Dulgan', 'Grask', 'Hurgan', 'Krosk', 'Mudrak', 'Ognar', 'Uzgash', 'Vorlag'],
    female: ['Agra', 'Bulgra', 'Drazka', 'Gharza', 'Krusha', 'Mogda', 'Ruzka', 'Ushka', 'Vragna', 'Zulka'],
  },
  goblin: {
    // No pure male goblins exist (BEASTFOLK_SPEC.md) — every goblin union
    // partner is female by construction (formUnion assigns the spouse the
    // opposite gender from the post hero they're wedding). This small male
    // slice only ever gets read for a mixed child whose dominant ancestry
    // happens to be goblin but whose rolled gender is male (childGender can
    // still roll male for a mixed line — the "no male goblins" rule is about
    // pure goblins, not human-goblin offspring).
    male: ['Skarn', 'Grubbik', 'Nizzle', 'Rottick', 'Skreel'],
    female: ['Cazza', 'Fenka', 'Grizna', 'Ikka', 'Nettla', 'Ovka', 'Pikka', 'Skree', 'Tikra', 'Wretta'],
  },
};

/**
 * A dependant name for a people + gender, chosen deterministically by `seed`
 * (a monotonic dependant-id counter), so a given save always yields the same
 * name. Falls back to the Imanian pool for any unmapped heritage.
 */
export function dependantName(heritage: Heritage, gender: Gender, seed: number): string {
  const pool = (NAMES[heritage] ?? NAMES.imanian)[gender];
  return pool[Math.abs(seed) % pool.length];
}
