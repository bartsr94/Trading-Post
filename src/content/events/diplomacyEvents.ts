// First contact (DIPLOMACY_DISCOVERY_SPEC.md): one generic chain event, queued
// by the engine whenever a community (any market settlement, faction-seated
// or not — see isCommunity) is discovered for the first time. `{destination}`
// interpolates from the triggering location's context
// (OutcomeContext.locationId), never a fixed location literal here — the
// same event must read naturally for any of the game's communities. A
// faction-less community (e.g. neutral-ground Umoja-Njema) still fires this
// event, but its communityStanding/communityGrievance outcomes silently
// no-op (no diplomacy seat to hold them) — first contact there is a one-time
// flavor beat, not the start of a tracked relationship.

import { TUNING } from '../tuning';
import type { GameEvent } from '../../engine/events/types';

const fc = TUNING.diplomacy.firstContact;

export const DIPLOMACY_EVENTS: GameEvent[] = [
  {
    id: 'post_first_contact',
    category: 'chain',
    illustration: 'first_contact',
    title: 'First Contact',
    text: 'Out past the edge of the surveyed country, {hero}\'s party comes upon a settlement no map of yours has ever held — {destination}. Word of you has plainly not reached them either. Whatever happens in the next few minutes is the only impression they will carry of the post for a long while.',
    conditions: [],
    weight: 0,
    binding: { type: 'random' },
    choices: [
      {
        label: 'Approach in peace.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: fc.checkDifficulty, tags: ['diplomacy', 'strangers'] },
        outcomes: {
          critSuccess: {
            text: '{hero} goes forward alone, hands open, and finds the right words before anyone can reach for a spear. By the time the party turns for home, there is laughter behind them, not silence.',
            outcomes: [{ type: 'communityStanding', delta: fc.peaceStandingGainCrit }],
          },
          success: {
            text: '{hero} raises empty hands and waits. It is enough. Words are traded, cautiously, and the party leaves with a name for the place and no blood on the ground.',
            outcomes: [{ type: 'communityStanding', delta: fc.peaceStandingGainSuccess }],
          },
          failure: {
            text: 'The gesture lands wrong, or too late, or not at all. Nothing is won and nothing is lost — but {hero} feels the whole walk home how close that was to going badly.',
            outcomes: [{ type: 'stress', delta: fc.peaceFailureStress }],
          },
          critFailure: {
            text: 'Something in {hero}\'s approach reads as insult rather than greeting. The party is driven off with shouting at their backs, and the memory of it will not fade quickly.',
            outcomes: [
              { type: 'communityStanding', delta: -fc.peaceCritFailureStandingLoss },
              { type: 'communityGrievance', delta: fc.peaceCritFailureGrievance },
            ],
          },
        },
      },
      {
        label: 'Show strength — let them see you will not be pushed.',
        check: { skill: 'combat', stat: 'might', difficulty: fc.checkDifficulty, tags: ['intimidation', 'strangers'] },
        outcomes: {
          success: {
            text: '{hero} squares the party up in plain sight — armed, unhurried, unmistakable. The message is received. Nobody moves for a long moment, and then the party is allowed to withdraw.',
            outcomes: [
              { type: 'communityStanding', delta: -fc.hostileStandingLossSuccess },
              { type: 'communityGrievance', delta: fc.hostileGrievanceSuccess },
            ],
          },
          failure: {
            text: 'The posturing is answered in kind, and then with fists. The party breaks off bruised and short of breath, having taught this place nothing except that you are worth watching closely.',
            outcomes: [
              { type: 'communityStanding', delta: -fc.hostileStandingLossFailure },
              { type: 'communityGrievance', delta: fc.hostileGrievanceFailure },
              { type: 'health', delta: -fc.hostileFailureHealth },
              { type: 'stress', delta: fc.hostileFailureStress },
            ],
          },
          critFailure: {
            text: 'It goes about as badly as it can without anyone dying. {hero} comes home wounded, and word of the encounter will reach this people\'s kin long before any envoy of yours does.',
            outcomes: [
              { type: 'communityStanding', delta: -fc.hostileStandingLossCritFailure },
              { type: 'communityGrievance', delta: fc.hostileGrievanceCritFailure },
              { type: 'health', delta: -fc.hostileCritFailureHealth },
              { type: 'stress', delta: fc.hostileCritFailureStress },
            ],
          },
        },
      },
      {
        label: 'Keep your distance.',
        outcomes: {
          success: {
            text: '{hero} calls the party back before anyone crosses the open ground. Whatever this place is, it can wait for a proper embassy — the post has made note of them, and moved on.',
            outcomes: [],
          },
        },
      },
    ],
  },
];
