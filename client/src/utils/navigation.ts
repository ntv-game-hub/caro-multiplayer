export function routeSlug() {
  const match = window.location.pathname.match(/^\/room\/([^/]+)/);
  return match?.[1];
}

export function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
