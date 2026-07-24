// Raiding content (RAIDING_SPEC.md). The battle math lives in engine/raids.ts;
// these events supply narrative and the content-side triggers — chiefly the
// `startRaid` outcome, which lets a scene escalate into an actual raid the
// player must defend. Most raids arrive automatically via the turn pipeline's
// notoriety roll; these give the player a way to provoke (or forestall) one.
// Tone per CLAUDE.md: second person, terse, 60–120 words, choices as intentions.

import type { GameEvent } from '../../engine/events/types';

export const RAID_EVENTS: GameEvent[] = [
  {
    id: 'raid_gathering_warband',
    category: 'post',
    illustration: 'raid_warning',
    title: 'Smoke on the Ridge',
    text: 'A herder comes in at a dead run: an orc war-band is gathering on the ridge, more of them each day, and they are looking down at the post the way men look at a laden table. {hero} has a little time — enough to send them something to chew on and buy a season, or to stand the guard to and let them come. How the post answers now will be remembered either way.',
    conditions: [
      { type: 'standingAtMost', faction: 'BEASTFOLK', value: -30 },
      { type: 'raidReady' },
    ],
    weight: 8,
    cooldownTurns: 10,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    choices: [
      {
        label: 'Send them silver and grain to forestall it.',
        requires: [{ type: 'silverAtLeast', value: 20 }],
        outcomes: {
          success: {
            text: 'The gift goes up the ridge on a mule with a boy who comes back grinning and unharmed. It is not respect they send back, but it is quiet — for now.',
            outcomes: [
              { type: 'silver', delta: -20 },
              { type: 'good', good: 'grain', delta: -6 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 3 },
              { type: 'history', text: 'Bought off a gathering war-band before it could strike.' },
            ],
          },
        },
      },
      {
        label: 'Stand the guard to and wait.',
        outcomes: {
          success: {
            text: 'The post sleeps in its boots for a week. Watchfires burn down to coals along the palisade, and every hand knows where the spears are stacked.',
            outcomes: [
              { type: 'history', text: 'Stood ready against a gathering war-band.' },
            ],
          },
        },
      },
      {
        label: 'Send word up the ridge that they are not welcome.',
        check: { skill: 'combat', stat: 'resolve', difficulty: 12, tags: ['BEASTFOLK', 'intimidation'] },
        outcomes: {
          critSuccess: {
            text: 'The messenger says it plainly, and {hero} has drilled the guard well enough that the threat behind it is real. The war-band thinks better of it and drifts off to easier country.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 2 },
              { type: 'history', text: 'Faced down a war-band with nothing but nerve and a well-drilled guard.' },
            ],
          },
          success: {
            text: 'The message lands, but so does the insult. They do not come today — but they are coming.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: -4 }],
          },
          failure: {
            text: 'The insult is all they needed. By nightfall the ridge is empty, which is worse than full — they are already moving on the post.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: -5 },
              { type: 'startRaid', faction: 'BEASTFOLK' },
            ],
          },
          critFailure: {
            text: 'The messenger does not come back. What comes instead, fast and furious and in force, is the war-band itself.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: -6 },
              { type: 'startRaid', faction: 'BEASTFOLK', severity: 'warband' },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'raid_aftermath_rally',
    category: 'post',
    illustration: 'raid_aftermath',
    title: 'After the Raiders',
    text: 'The raiders are gone and the counting has begun — what was carried off, what was burned, who is not answering the roll. The post looks to {hero} to say what the days after will be: heads down and rebuild, or a hard word that this will not be borne a second time.',
    conditions: [{ type: 'raidedRecently', turns: 4 }],
    weight: 6,
    cooldownTurns: 12,
    binding: { type: 'highestStat', stat: 'resolve' },
    choices: [
      {
        label: 'Rebuild, and let it be forgotten.',
        outcomes: {
          success: {
            text: 'The work is slow and the mood is low, but the palisade rises again and the fields are put back in order. No one speaks of it much.',
            outcomes: [{ type: 'contentment', delta: -1 }],
          },
        },
      },
      {
        label: 'Swear the post will hold next time — and drill it in.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 10 },
        outcomes: {
          success: {
            text: '{hero} makes the promise sound like a plan, and the plan sound like a certainty. The guard trains harder; the post stands a little straighter.',
            outcomes: [
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'Rallied the post after a sacking, vowing it would not happen again.' },
            ],
          },
          failure: {
            text: 'The words come out, but they ring hollow to people still picking through ash. A few quietly decide the frontier is not worth it.',
            outcomes: [{ type: 'contentment', delta: -1 }],
          },
        },
      },
    ],
  },
];
