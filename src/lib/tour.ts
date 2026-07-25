import { driver, type Config } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour-theme.css";

const SEEN_KEY = "tugboat.tourSeen.v1";

const commonConfig: Config = {
  showProgress: true,
  progressText: "{{current}} / {{total}}",
  nextBtnText: "Suivant →",
  prevBtnText: "← Précédent",
  doneBtnText: "Terminé ✓",
  overlayColor: "rgba(15, 16, 27, 0.75)",
  popoverClass: "tugboat-tour",
  animate: true,
};

function stepList() {
  return [
    {
      popover: {
        title: "👋 Bienvenue dans Tugboat",
        description:
          "Un terminal multi-panels avec un launcher visuel. On fait un tour rapide de ce que tu peux faire.",
      },
    },
    {
      element: '[data-tour="sidebar"]',
      popover: {
        title: "📌 La sidebar",
        description:
          "Tes boutons launcher vivent ici, groupés. Un clic sur un bouton lance sa commande dans un onglet, un split ou plusieurs panels à la fois.",
        side: "right" as const,
        align: "start" as const,
      },
    },
    {
      element: '[data-tour="tab-bar"]',
      popover: {
        title: "📑 Onglets",
        description:
          "Cmd+T pour nouvel onglet, Cmd+Q pour fermer. Les onglets restent en vie même quand tu passes de l'un à l'autre — tes shells continuent en arrière-plan.",
        side: "bottom" as const,
      },
    },
    {
      popover: {
        title: "🖱️ Splits dans un onglet",
        description:
          "Cmd+D pour split vertical (nouveau panel à droite), Cmd+Shift+D pour split horizontal (en bas). Drag sur le séparateur bleu pour ajuster.",
      },
    },
    {
      element: '[data-tour="new-btn"]',
      popover: {
        title: "➕ Créer un bouton",
        description:
          "Formulaire complet : commande, arguments, dossier de travail (avec picker natif), et surtout multi-panels avec conditions d'attente. Idéal pour un workflow Dev Supabase, Docker compose, etc.",
        side: "right" as const,
        align: "end" as const,
      },
    },
    {
      element: '[data-tour="json-btn"]',
      popover: {
        title: "📝 Édition JSON",
        description:
          "Si tu préfères éditer la config à la main, buttons.json ouvre un éditeur intégré avec validation live. Cmd+S pour save.",
        side: "right" as const,
        align: "end" as const,
      },
    },
    {
      popover: {
        title: "⌘K Command palette",
        description:
          "Cmd+K ouvre un launcher rapide qui liste tous tes boutons + shells vides (tab/split-h/split-v). ↑↓ pour naviguer, Enter pour lancer.",
      },
    },
    {
      popover: {
        title: "🎯 Ctrl+C safe",
        description:
          "Tes boutons tournent dans un shell wrapper : Ctrl+C interrompt la commande mais tu retrouves ton prompt. Les alias zsh/bash marchent aussi.",
      },
    },
    {
      popover: {
        title: "✅ C'est parti",
        description:
          "Tu peux relancer ce tour à tout moment via le bouton ? dans la sidebar. Bon usage !",
      },
    },
  ];
}

export function startTour() {
  const d = driver({
    ...commonConfig,
    steps: stepList(),
    onDestroyStarted: () => {
      localStorage.setItem(SEEN_KEY, "1");
      d.destroy();
    },
    onDestroyed: () => {
      localStorage.setItem(SEEN_KEY, "1");
    },
  });
  d.drive();
}

export function maybeStartTourOnBoot() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEEN_KEY) === "1") return;
  setTimeout(() => startTour(), 800);
}

export function resetTour() {
  localStorage.removeItem(SEEN_KEY);
}
