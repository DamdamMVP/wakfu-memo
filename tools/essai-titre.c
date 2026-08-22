/*
 * Checks the title matching rule laid down by
 * `patches/electron-overlay-window.patch`.
 *
 * Compiles the patched header on its own — no xcb, no Win32, no N-API: the rule
 * is text, and text is judged without a platform. Driven by
 * `src/main/surjeu-titre.test.ts`, which passes the header path.
 */

#include <stdio.h>
#include <uv.h>
#include "overlay_window.h"

static int echecs = 0;

static void juge(const char* titre, const char* cherche, bool attendu) {
  bool obtenu = ow_title_matches(titre, cherche);
  if (obtenu != attendu) {
    printf("ECHEC « %s » vs « %s » : attendu %d, obtenu %d\n", titre, cherche, attendu, obtenu);
    echecs++;
  }
}

int main(void) {
  /* The client title before any login. */
  juge("WAKFU", "WAKFU", true);
  /* The in-game title: the character, then the client name. */
  juge("S'Alu-Ca'Va - WAKFU", "WAKFU", true);
  /* Multi-account: every client carries its own character. */
  juge("Damdamisback - WAKFU", "WAKFU", true);

  /* What must not pass for the game. */
  juge("Guide WAKFU", "WAKFU", false);          /* no separator */
  juge("WAKFU - Encyclopedie", "WAKFU", false); /* wrong side of the suffix */
  juge("wakfu", "WAKFU", false);                /* case matters */
  juge("", "WAKFU", false);
  juge("WAKFU", "", false);
  juge(NULL, "WAKFU", false);
  juge("S'Alu-Ca'Va - WAKFU", NULL, false);

  printf(echecs == 0 ? "OK\n" : "%d echec(s)\n", echecs);
  return echecs == 0 ? 0 : 1;
}
