# Tugboat

Un launcher de terminaux configurable pour macOS. Tu définis des boutons (SSH, dev servers, `docker compose up`, `claude`, `supabase start`…), tu les regroupes, tu cliques — chaque bouton ouvre un onglet ou un split avec la commande déjà lancée.

L'idée : arrêter de retaper les 15 mêmes commandes chaque matin, sans quitter le confort d'un vrai terminal (xterm.js, PTY natif, ANSI complet).

---

## Fonctionnalités

- **Onglets + splits horizontaux/verticaux** avec ratio ajustable à la souris
- **Groupes de boutons** dans la sidebar (repliables, réordonnables, contextuel clic-droit)
- **Panels séquentiels** — un bouton peut ouvrir plusieurs commandes en chaîne avec délais ou attente d'un texte spécifique dans le panel précédent (utile pour un `supabase start` puis attendre "Started" avant de lancer les migrations)
- **Multi-instance opt-in** — par défaut, cliquer sur un bouton déjà lancé rebascule sur son onglet ; coche la case pour autoriser plusieurs instances
- **Session restaurée** au redémarrage (onglets, splits, ratios)
- **Command Palette** (⌘K) pour rechercher et lancer sans quitter le clavier
- **Thème** clair / sombre / système, couleurs personnalisables (fond, texte, boutons)
- **Sélecteur d'icônes** intégré (emojis catégorisés)
- **Auto-updater** signé Ed25519
- **Config JSON** éditable à la main pour synchro entre machines

### Raccourcis

| Raccourci | Action |
|---|---|
| `⌘K` | Command palette |
| `⌘T` | Nouvel onglet |
| `⌘W` | Fermer le panel actif |
| `⌘Q` | Fermer l'onglet |
| `⌘D` | Split horizontal |
| `⌘⇧D` | Split vertical |
| `⌘⏎` (dans l'éditeur de bouton) | Sauvegarder |

---

## Installation

### Utilisateur (release signée)

Télécharge le `.app.tar.gz` depuis [Deuli-P/tugboat-releases](https://github.com/Deuli-P/tugboat-releases/releases/latest), décompresse, glisse dans `/Applications`. Les mises à jour ultérieures se font depuis l'app (bouton "Vérifier les mises à jour" en bas de la sidebar).

Uniquement **macOS Apple Silicon** (`darwin-aarch64`) pour l'instant.

### Depuis les sources

Prérequis : Node 20+, [pnpm](https://pnpm.io/), Rust stable, Xcode CLT (`xcode-select --install`).

```bash
git clone https://github.com/Deuli-P/tugboat.git
cd tugboat
pnpm install
pnpm tauri dev
```

Build production :

```bash
pnpm tauri build
```

Le `.app` sort dans `src-tauri/target/release/bundle/macos/`.

---

## Configuration

Les boutons sont persistés dans `~/Library/Application Support/com.pierre.tugboat/buttons.json`. Deux façons de les gérer :

1. **UI** — bouton "+ Nouveau bouton" en bas de la sidebar, ou clic-droit sur un groupe existant
2. **JSON direct** — bouton `buttons.json` en bas de la sidebar ouvre l'éditeur intégré

Exemple minimal :

```json
{
  "version": 1,
  "groups": [
    {
      "id": "dev",
      "label": "Dev",
      "icon": "🛠",
      "buttons": [
        {
          "id": "kivaou-back",
          "label": "Kivaou backend",
          "icon": "🚀",
          "command": "pnpm",
          "args": ["dev"],
          "cwd": "/Users/deuli/Documents/GitHub/kivaou-backend",
          "openIn": "tab",
          "multiInstance": false
        }
      ]
    }
  ]
}
```

**Champs disponibles pour un bouton :**

| Champ | Type | Description |
|---|---|---|
| `id` | string | Identifiant unique (auto si créé par l'UI) |
| `label` | string | Texte affiché |
| `icon` | string \| null | Emoji ou vide |
| `command` | string | Exécutable |
| `args` | string[] | Arguments |
| `cwd` | string \| null | Dossier de travail (vide = `~`) |
| `openIn` | `"tab"` \| `"split-h"` \| `"split-v"` | Où ouvrir |
| `multiInstance` | boolean | Autorise plusieurs onglets pour ce bouton (`openIn: "tab"` seulement) |
| `extraPanes` | ExtraPane[] | Panels supplémentaires enchaînés |

Un `ExtraPane` supporte `delayMs` (attendre N ms avant de lancer) et `waitForText` (attendre l'apparition d'un texte dans le panel précédent avant de lancer — pratique pour des services qui affichent "ready" avant que le suivant en dépende).

---

## Stack et choix d'architecture

### Tauri 2 (Rust + WebView native)

Choisi contre Electron pour la taille du bundle (~15 Mo vs ~150 Mo), la consommation mémoire, et un vrai processus Rust pour manipuler les PTY sans dépendre d'un binding Node. La WebView macOS native rend le tout indistinguable d'une app Cocoa en usage.

### React 19 + Zustand

React pour l'écosystème et la vélocité. Zustand plutôt que Redux/Jotai/Context : store minimal, zéro boilerplate, une API en 3 fonctions. Deux stores :

- `state/tabs.ts` — arbre d'onglets/splits (récursif, chaque nœud est un `leaf` ou un `split`)
- `state/buttons.ts` — config des boutons hydratée depuis Rust
- `state/ui.ts` — préférences transverses (sidebar, thème, modal settings)

### Vite 7 + TypeScript strict

Build rapide, HMR, sortie ES modules. TypeScript pour la stabilité au refactor — le typage des `PaneNode` récursifs est ce qui rend les splits imbriqués gérables.

### xterm.js + FitAddon + WebLinksAddon

Standard de facto pour rendre du terminal dans un browser. `FitAddon` calcule les rows/cols en fonction de la taille visible et les propage au PTY natif (Rust) via un event. Les liens sont cliquables — `openUrl` / `openPath` de Tauri décide entre navigateur, éditeur, ou Finder selon le scheme.

### portable_pty (Rust)

Bibliothèque cross-platform de spawn PTY. Chaque terminal xterm.js correspond à un `PtySession` côté Rust, avec un thread dédié qui lit le master et emit les octets vers le front via `pty:data:{id}`. Le shell login (`$SHELL -l`) est spawné dans le PTY pour hériter du `PATH` et des alias de l'utilisateur — puis la commande du bouton est écrite comme si l'utilisateur la tapait. Volontairement : ça permet d'utiliser des fonctions shell, aliases, etc.

### Updater séparé (Deuli-P/tugboat-releases)

Le repo source publie ses artefacts signés dans un second repo public dédié. Deux raisons :
1. Le repo source peut rester privé si besoin sans casser les updates
2. Séparation propre entre code et binaires — le repo `tugboat-releases` reste minimal et n'a pas d'historique parasite

La signature Ed25519 (Tauri updater) empêche un tiers de pousser une fausse mise à jour sans la clé privée locale.

---

## Développement

```bash
pnpm tauri dev     # dev avec hot reload
pnpm build         # tsc + vite build (front seulement)
pnpm tauri build   # bundle .app production
```

Fichiers pertinents :

- `src/App.tsx` — assemblage sidebar + tabbar + panels + modals
- `src/state/tabs.ts` — arbre récursif des splits, mutations
- `src/lib/launch.ts` — logique de lancement d'un bouton (nouvel onglet, split, panels séquentiels)
- `src-tauri/src/pty.rs` — spawn PTY, écriture, resize, kill
- `src-tauri/src/config.rs` — persist des boutons dans le app data dir

---

## Releases

Deux voies possibles.

### Automatique (recommandé)

Bump la version et pousse sur `main` — le workflow [`.github/workflows/release.yml`](.github/workflows/release.yml) build, signe, et publie sur `tugboat-releases`.

```bash
pnpm bump:patch   # ou :minor, :major, ou pnpm bump 0.5.0
git push origin main
```

Prérequis (à configurer une fois côté repo GitHub) :

- Secret `TAURI_SIGNING_PRIVATE_KEY` = contenu de `~/.tauri/tugboat_updater.key`
- Secret `RELEASES_TOKEN` = PAT fine-grained avec `contents:write` sur `Deuli-P/tugboat-releases`

### Manuel (depuis ta machine)

Si CI down ou envie de release locale :

```bash
pnpm release:patch   # ou :minor, :major, ou pnpm release 0.5.0
```

Requiert la clé de signature à `~/.tauri/tugboat_updater.key` et `gh` authentifié.

---

## Licence

Aucune licence publiée pour l'instant — usage interne / personnel. À déterminer avant tout partage large.
