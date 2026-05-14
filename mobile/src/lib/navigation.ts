import type { Href, Router } from 'expo-router';

export function goBackOrReplace(router: Router, fallbackHref: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallbackHref);
}
