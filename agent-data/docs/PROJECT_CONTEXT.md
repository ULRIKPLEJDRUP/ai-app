# Project Context – AI Training Coach App

## Formål
Dette projekt er en personlig trænings- og sundhedsapp med fokus på:
- RM-baseret styrketræning
- Fleksibel programlogik
- Friktionsfri workout-eksekvering
- AI-coach som sparringspartner over tid

Målet er at bygge et system, der er bedre end klassiske fitness-apps (fx Garmin) ved at kombinere:
data → intelligent logik → god UX.

---

## Centrale designprincipper
- **Step-vis eksekvering**: én ændring ad gangen
- **Minimal støj**: svar først, når input er givet
- **Data først**: RM, øvelser, mål og udstyr er “sandheden”
- **Historik må aldrig ødelægges**
- **Alt skal kunne justeres undervejs i træning**

---

## Nuværende arkitektur (kort)
- `exerciseCatalog.js`: canonical øvelsesbibliotek (keys, aliases, tags)
- `rm.json`: RM-data pr. øvelse (målt reps/kg → estimeret 1RM → training max)
- `baselineVault.js`: baseline-logik
- `workoutPlanner.js`: fallback: last workout → baseline → RM
- CLI-workflow virker, UI er under opbygning

---

## Vigtige konventioner
- Øvelser refereres altid via `exerciseKey`
- RM kan være:
  - kg-baseret
  - kropsvægt
  - tidsbaseret (fx ab-wheel, plank)
- RM, programmer og mål skal kunne kobles senere

---

## Arbejdsstil (vigtigt for AI-assistent)
- Skriv **kun det, der er nødvendigt**
- Vent på bruger-input før næste skridt
- Antag ikke, at noget er forstået uden bekræftelse
- Prioritér implementerbar kode frem for forklaring

---

Se også: `IDE_LISTE.md`
