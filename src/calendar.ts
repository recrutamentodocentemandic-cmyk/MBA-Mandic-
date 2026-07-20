import { readFileSync } from "node:fs";
import { DateTime } from "luxon";

interface CalendarFile {
  timezone: string;
  modules: { id: string; titulo: string; presencial: string }[];
}

export interface Milestone {
  moduleId: string;
  moduleTitle: string;
  kind: string;
  label: string;
  due: DateTime;
}

const cal: CalendarFile = JSON.parse(readFileSync("./config/calendar.json", "utf-8"));

export function allMilestones(): Milestone[] {
  const tz = cal.timezone;
  const out: Milestone[] = [];
  cal.modules.forEach((m, i) => {
    const presencial = DateTime.fromISO(m.presencial, { zone: tz });
    const next = cal.modules[i + 1];
    const push = (kind: string, label: string, due: DateTime) =>
      out.push({ moduleId: m.id, moduleTitle: m.titulo, kind, label, due });

    push("exercicio_pre", "Exercício pré-encontro (entrega até quinta)", presencial.minus({ days: 2 }));
    push("presencial", "Sábado presencial (08h–17h)", presencial);
    push("reflexao", "Reflexão individual (D+10)", presencial.plus({ days: 10 }));
    push("atividade_grupo", "Atividade em grupo (D+15)", presencial.plus({ days: 15 }));
    if (next) {
      push(
        "demo",
        `Demo ao vivo do agente de ${m.id} (início do ${next.id})`,
        DateTime.fromISO(next.presencial, { zone: tz })
      );
    }
  });
  return out.sort((a, b) => a.due.toMillis() - b.due.toMillis());
}
