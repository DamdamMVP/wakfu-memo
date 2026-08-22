/*
 * A stub, on purpose, and empty on purpose.
 *
 * `overlay_window.h` includes `<uv.h>` for the library's own needs, but the
 * only thing this repo compiles out of that header is `ow_title_matches`, which
 * is pure string work. Pulling the real libuv in would mean depending on the
 * Node headers node-gyp caches under `~/.cache/node-gyp` — a path that exists
 * only after a native build, that no editor knows about, and that made
 * `tools/essai-titre.c` unopenable without a wall of errors.
 *
 * If the day comes when the patched header genuinely needs a libuv type, the
 * compile fails loudly and this file is the place to look.
 */
#ifndef WAKFU_MEMO_BOUCHON_UV_H_
#define WAKFU_MEMO_BOUCHON_UV_H_

/* Just enough for the declarations the header carries to parse. */
typedef unsigned long uv_thread_t;

#endif
