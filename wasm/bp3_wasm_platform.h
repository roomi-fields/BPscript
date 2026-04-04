/*  bp3_wasm_platform.h — Platform shim for Emscripten/WASM build of BP3
 *  Force-included before any other header via -include flag.
 *  Prevents -BP3.h from pulling in ALSA or Windows headers.
 */

#ifndef BP3_WASM_PLATFORM_H
#define BP3_WASM_PLATFORM_H

/* Emscripten defines __linux__ by default, which causes -BP3.h to
   #include <alsa/asoundlib.h>. We undefine platform macros so that
   the platform-specific blocks in -BP3.h are skipped entirely. */
#ifdef __linux__
#undef __linux__
#endif

#ifdef _WIN64
#undef _WIN64
#endif

/* We still need standard POSIX/C headers that the linux block would
   have pulled in: */
#include <unistd.h>
#include <termios.h>
#include <time.h>
#include <errno.h>
#include <stdint.h>
#include <stddef.h>
#include <stdarg.h>
#include <emscripten.h>

/* Provide the platform-specific types that -BP3.h defines inside
   its #if defined(_WIN64) || defined(__linux__) block (lines 934-949).
   Since we undef'd both guards, we must provide them ourselves. */
typedef uint64_t UInt64;
typedef size_t Size;

typedef struct Rect {
    int top;
    int left;
    int bottom;
    int right;
} Rect;

typedef struct {
    unsigned char* data;
    int length;
    unsigned long timestamp;
} MIDIPacket;

typedef char** Handle;

/* noErr is defined in the _WIN64 block */
#define noErr 0

#endif /* BP3_WASM_PLATFORM_H */
