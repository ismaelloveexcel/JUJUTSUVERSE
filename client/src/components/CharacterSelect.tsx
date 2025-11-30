import { Card } from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

export type Character = {
  id: string;
  name: string;
  img: string;
  power: number;
  techniques: string[];
};

export const CHARACTERS: Character[] = [
  {
    id: "gojo",
    name: "Satoru Gojo",
    img: "/assets/gojo.png",
    power: 95,
    techniques: ["Hollow Purple", "Domain Expansion"],
  },
  {
    id: "sukuna",
    name: "Ryomen Sukuna",
    img: "/assets/sukuna.png",
    power: 98,
    techniques: ["Cleave", "Dismantle"],
  },
  {
    id: "yuji",
    name: "Yuji Itadori",
    img: "/assets/yuji.png",
    power: 88,
    techniques: ["Divergent Fist", "Black Flash"],
  },
];

type CharacterSelectProps = {
  selectedId?: string;
  onSelect: (character: Character) => void;
};

export function CharacterSelect({
  selectedId,
  onSelect,
}: CharacterSelectProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {CHARACTERS.map((character) => {
        const initials = character.name
          .split(" ")
          .map((token) => token[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        const isSelected = selectedId === character.id;

        return (
          <Card
            key={character.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(character)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(character);
              }
            }}
            className={`flex flex-col gap-4 border transition-all hover:-translate-y-1 hover:border-primary/60 ${
              isSelected ? "border-primary shadow-lg shadow-primary/40" : ""
            }`}
          >
            <div className="flex items-center gap-4 p-4">
              <Avatar className="h-14 w-14 border border-white/20">
                <AvatarImage src={character.img} alt={character.name} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-white/60">
                  Power {character.power}
                </p>
                <h3 className="text-xl font-orbitron text-white">
                  {character.name}
                </h3>
              </div>
            </div>

            <div className="px-4 pb-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                Techniques
              </p>
              <ul className="mt-2 space-y-1 text-sm text-white/80">
                {character.techniques.map((technique) => (
                  <li key={technique}>• {technique}</li>
                ))}
              </ul>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
