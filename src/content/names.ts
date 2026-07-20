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
  dustwalker: {
    male: ['Baturu', 'Erke', 'Ganta', 'Khenbish', 'Mergen', 'Naranbat', 'Sube', 'Temujin', 'Yesugei', 'Chuluun'],
    female: ['Altani', 'Bolormaa', 'Enkhee', 'Khulan', 'Nomin', 'Oyuun', 'Saran', 'Tuya', 'Uranchimeg', 'Yesui'],
  },
  bejasi: {
    male: ['Adaro', 'Batu', 'Iri', 'Kaveh', 'Mbeki', 'Oru', 'Serat', 'Turi', 'Vesh', 'Zhoran'],
    female: ['Ashka', 'Dela', 'Iyari', 'Kessa', 'Mira', 'Osei', 'Ravah', 'Suri', 'Vessa', 'Yenni'],
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
