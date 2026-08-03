// Petitions (POV_CHARACTER_SPEC.md §4.4): consequences that already move
// silently as numbers — sour contentment, Company displeasure, a raid's
// aftershock, a crowded Concession — get one more surface, someone at the
// post bringing it to whoever's actually present to hear it. Ordinary
// `post`-category content, bound the same generic way as anything else
// (never locked to the POV hero specifically — see the spec for why); the
// POV hero simply comes up sometimes, like any of the other 6.

import type { GameEvent } from '../../engine/events/types';
import { makeChoiceEvent, outcome } from './eventHelpers';

export const PETITION_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'petition_wages',
    category: 'post',
    illustration: 'petition_wages',
    title: 'A Line at the Door',
    text: "A handful of idle hands catch {hero} before the morning's work starts, doing the talking the rest are too proud to. The grain ration has felt thin for weeks, they say, and the silver even thinner. Nobody's threatening anything — yet. They're asking, plainly, what the post means to do about it.",
    conditions: [{ type: 'contentmentAtMost', value: 4 }],
    weight: 8,
    cooldownTurns: 4,
    binding: { type: 'highestStat', stat: 'charm' },
    choices: [
      {
        type: 'checked',
        label: 'Promise a fairer share, and mean it.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 10 },
        critSuccess: {
          text: "{hero} doesn't just talk — walks the ration line personally, sees the shortfall firsthand, and says out loud what will change. It lands.",
          outcomes: [outcome.contentment(3), outcome.history('Won the post back over a wages grievance.')],
        },
        success: {
          text: "It's not much more than words today, but they're the right words, said plainly and without excuses. The line breaks up satisfied enough.",
          outcomes: [outcome.contentment(2)],
        },
        failure: {
          text: "{hero} means well, but it comes out as excuses, and everyone in the line has heard excuses before. Nothing changes except the mood.",
          outcomes: [outcome.contentment(-1)],
        },
        critFailure: {
          text: "{hero} loses patience with the wrong person at the wrong moment, and what could have been smoothed over turns into a grudge the whole post hears about by evening.",
          outcomes: [outcome.contentment(-2), outcome.stress(1)],
        },
      },
      {
        type: 'flat',
        label: 'Tell them to be grateful for what they have.',
        text: "It's not what they came to hear, and it shows. They go back to work, but slower, and quieter than before — the kind of quiet that doesn't forget.",
        outcomes: [outcome.contentment(-2)],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'petition_company_standing',
    category: 'post',
    illustration: 'petition_factor',
    title: 'A Word About the Ledger',
    text: "One of the company finds {hero} alone and says what nobody's said aloud yet: word from Thornwatch hasn't been kind lately — fewer goods on the last boat, a factor's letter with a harder edge than usual. They want to know, plainly, whether the post is in real trouble with the Company, and what {hero} means to do about it.",
    conditions: [{ type: 'standingAtMost', faction: 'CHARTER_COMPANY', value: -10 }],
    weight: 6,
    cooldownTurns: 5,
    binding: { type: 'highestSkill', skill: 'diplomacy' },
    factions: ['CHARTER_COMPANY'],
    choices: [
      {
        type: 'checked',
        label: 'Lay out the truth, and a plan.',
        check: { skill: 'diplomacy', stat: 'wits', difficulty: 10 },
        critSuccess: {
          text: "{hero} doesn't soften it, but doesn't dress it in dread either — just the facts, and a real plan to turn them around. It steadies more than one nerve.",
          outcomes: [outcome.contentment(2), outcome.history('Talked the company down from Company-standing worries.')],
        },
        success: {
          text: 'It could go worse than it is, {hero} says, and it could go better — and here is what that better looks like. Good enough, for now.',
          outcomes: [outcome.contentment(1)],
        },
        failure: {
          text: "{hero} means to reassure and instead confirms every fear in the room, one honest word at a time. Better to have said less.",
          outcomes: [outcome.stress(1)],
        },
        critFailure: {
          text: '{hero} loses the thread halfway through, and what was meant as reassurance leaves the room more frightened than it started.',
          outcomes: [outcome.contentment(-2), outcome.stress(1)],
        },
      },
      {
        type: 'flat',
        label: "Tell them it's handled — it isn't their business.",
        text: 'It shuts the conversation down, which is not the same thing as settling it. The worry just goes back to being whispered instead of spoken.',
        outcomes: [outcome.contentment(-1)],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'petition_raid_aftermath',
    category: 'post',
    illustration: 'petition_raid',
    title: 'What Happens Now',
    text: "The post is still picking through what the raid left behind when someone — hands still not quite steady — corners {hero} to ask the question everyone's avoiding: was that the only time, or the first of several? People want to know whether to keep sleeping easy, or start sleeping with a blade close.",
    conditions: [{ type: 'raidedRecently', turns: 2 }],
    weight: 6,
    cooldownTurns: 4,
    binding: { type: 'highestStat', stat: 'resolve' },
    choices: [
      {
        type: 'checked',
        label: 'Speak plainly about the risk, and what stands ready for it.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 10 },
        critSuccess: {
          text: "{hero} doesn't pretend the danger is gone, but lays out exactly what will meet it next time — and says it with the kind of calm that spreads. The fear loses its grip.",
          outcomes: [outcome.contentment(2), outcome.history("Steadied the post's nerves after a raid.")],
        },
        success: {
          text: "Honest, and steady enough. It's not comfort exactly, but it's something to hold onto.",
          outcomes: [outcome.contentment(1)],
        },
        failure: {
          text: '{hero} means to be reassuring and instead just confirms how exposed everyone already feels.',
          outcomes: [outcome.stress(1)],
        },
        critFailure: {
          text: "{hero} fumbles it badly, and the fear that was already spreading finds a name and a face to blame.",
          outcomes: [outcome.contentment(-2)],
        },
      },
      {
        type: 'flat',
        label: 'Say nothing that isn\'t already obvious, and move on.',
        text: 'It reads as either confidence or indifference, and most of the post decides on the less generous of the two.',
        outcomes: [outcome.contentment(-1)],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'petition_overclaim',
    category: 'post',
    illustration: 'petition_land',
    title: 'No Room Left to Give',
    text: "A weathered hand who's worked the Concession since the first season finds {hero} out by the field markers and says it plainly: the land is carrying more people than it comfortably can, and everyone doing the actual digging and herding can feel it. They want to know if more ground is coming, or if this is simply how it is now.",
    conditions: [{ type: 'overClaim' }],
    weight: 7,
    cooldownTurns: 5,
    binding: { type: 'highestSkill', skill: 'lore' },
    choices: [
      {
        type: 'checked',
        label: 'Promise a push to grow the Concession.',
        check: { skill: 'lore', stat: 'wits', difficulty: 10 },
        critSuccess: {
          text: "{hero} doesn't just promise it — sketches out, on the spot, exactly which neighbor to approach and why it should work. It's the first plan anyone's heard that sounds like more than a hope.",
          outcomes: [outcome.contentment(2), outcome.history('Promised the post real relief for its crowded Concession.')],
        },
        success: {
          text: "It's a fair answer, and a true one: the post will ask for more land. Whether that lands in time is a different question, but the answer satisfies for now.",
          outcomes: [outcome.contentment(1)],
        },
        failure: {
          text: 'The promise comes out vaguer than {hero} meant it to, and vague promises about land are exactly what people here have learned not to trust.',
          outcomes: [outcome.contentment(-1)],
        },
        critFailure: {
          text: '{hero} overpromises badly, naming a timeline that everyone present can already tell is fantasy. It costs more trust than saying nothing would have.',
          outcomes: [outcome.contentment(-2)],
        },
      },
      {
        type: 'flat',
        label: 'Say the land will simply have to stretch further.',
        text: "It's the truth, as far as it goes, but it's not the answer anyone wanted to carry back to the rest.",
        outcomes: [outcome.contentment(-1)],
      },
    ],
  }),
];
