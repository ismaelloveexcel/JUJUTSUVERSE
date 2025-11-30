export type Technique = {
  id: string;
  name: string;
  description: string;
  power: number;
  cooldown: number;
};

export const MAX_HEALTH = 100;

export const TECHNIQUES: Technique[] = [
  {
    id: "hollow-purple",
    name: "Hollow Purple",
    description: "Space deletion strike combining Blue and Red.",
    power: 38,
    cooldown: 6,
  },
  {
    id: "domain-collapse",
    name: "Domain Collapse",
    description: "Short burst of domain energy that rattles opponents.",
    power: 34,
    cooldown: 5,
  },
  {
    id: "black-flash",
    name: "Black Flash",
    description: "A temporal distortion attack that amplifies impact.",
    power: 33,
    cooldown: 4,
  },
  {
    id: "cleave",
    name: "Cleave",
    description: "Precision slice that adapts to the opponent's toughness.",
    power: 31,
    cooldown: 3,
  },
  {
    id: "dismantle",
    name: "Dismantle",
    description: "Rapid slashes that unravel protections.",
    power: 28,
    cooldown: 3,
  },
  {
    id: "divergent-fist",
    name: "Divergent Fist",
    description: "Delayed cursed energy hit for double impact.",
    power: 26,
    cooldown: 2,
  },
];

export const TECHNIQUE_LOOKUP = Object.fromEntries(
  TECHNIQUES.map((technique) => [technique.id, technique]),
);
