let deferredInstallPrompt = null;
let isListening = false;
const subscribers = new Set();

export function isStandaloneDisplay() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function getSnapshot() {
  return {
    canPrompt: Boolean(deferredInstallPrompt),
    isInstalled: isStandaloneDisplay(),
  };
}

function notifySubscribers() {
  const snapshot = getSnapshot();
  subscribers.forEach((callback) => callback(snapshot));
}

export function initPwaInstallPrompt() {
  if (isListening) return;
  isListening = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notifySubscribers();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notifySubscribers();
  });
}

export function subscribePwaInstall(callback) {
  initPwaInstallPrompt();
  subscribers.add(callback);
  callback(getSnapshot());

  return () => {
    subscribers.delete(callback);
  };
}

export async function promptPwaInstall() {
  if (isStandaloneDisplay()) {
    return { outcome: "installed" };
  }

  if (!deferredInstallPrompt) {
    return { outcome: "unavailable" };
  }

  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  notifySubscribers();

  promptEvent.prompt();
  return promptEvent.userChoice;
}
