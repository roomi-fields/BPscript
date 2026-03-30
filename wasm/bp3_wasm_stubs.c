/*  bp3_wasm_stubs.c — Stub implementations for BP3 WASM build
 *
 *  These replace functions from excluded source files:
 *  MIDIdriver.c, MIDIstuff.c, MIDIfiles.c, PlayThings.c,
 *  MakeSound.c, Graphic.c, Csound.c, CsoundMaths.c,
 *  CsoundScoreMake.c, Script.c, ScriptUtils.c, HTML.c
 */

#include <math.h>
#include <emscripten.h>
#include "-BP3.h"
#include "-BP3decl.h"

/* Global: kmax from last TimeSet call, used by bp3_get_timed_tokens() */
long wasm_last_kmax = 0;

/* ============================================================
 * glibc-compatible rand()/srand() — TYPE_3 nonlinear additive feedback
 *
 * Musl (emscripten default) uses a simple LCG that produces completely
 * different sequences from glibc for the same seed.  This causes BP3
 * grammars with weighted-random rule selection (SUB with multiple
 * candidates) to diverge from native output.
 *
 * This implementation matches glibc's default random() generator
 * (TYPE_3, degree 31) so that WASM and native produce identical
 * results for the same seed.
 * ============================================================ */

#define GLIBC_DEG  31
#define GLIBC_SEP  3

static int32_t glibc_state[GLIBC_DEG + 1];
static int glibc_fptr = GLIBC_SEP;
static int glibc_rptr = 0;

void srand(unsigned int seed) {
    glibc_state[0] = (int32_t)seed;
    for (int i = 1; i < GLIBC_DEG; i++) {
        int32_t val = (16807LL * glibc_state[i - 1]) % 2147483647;
        if (val < 0) val += 2147483647;
        glibc_state[i] = val;
    }
    glibc_fptr = GLIBC_SEP;
    glibc_rptr = 0;
    /* Warm up the generator (matches glibc's __srandom_r) */
    for (int i = 0; i < 310; i++) rand();
}

int rand(void) {
    int32_t val;
    glibc_state[glibc_fptr] += glibc_state[glibc_rptr];
    val = (glibc_state[glibc_fptr] >> 1) & 0x7fffffff;
    glibc_fptr++;
    if (glibc_fptr >= GLIBC_DEG) {
        glibc_fptr = 0;
        glibc_rptr++;
    } else {
        glibc_rptr++;
        if (glibc_rptr >= GLIBC_DEG)
            glibc_rptr = 0;
    }
    return (int)val;
}

/* ============================================================
 * MIDIdriver.c stubs
 * ============================================================ */

int initializeMIDISystem(void) {
    return OK;
}

void closeMIDISystem(void) {
    return;
}

int MIDIflush(int force, int panic) {
    BP_NOT_USED(force);
    BP_NOT_USED(panic);
    return OK;
}

unsigned long getClockTime(void) {
    /* Return time in microseconds using clock() */
    return (unsigned long)((double)clock() / CLOCKS_PER_SEC * 1000000.0);
}

int ListenToEvents(void) {
    return OK;
}

void sendMIDIEvent(int type, int status, int data1, int data2,
                   unsigned char* sysex, int sysex_len, long time) {
    BP_NOT_USED(type); BP_NOT_USED(status);
    BP_NOT_USED(data1); BP_NOT_USED(data2);
    BP_NOT_USED(sysex); BP_NOT_USED(sysex_len);
    BP_NOT_USED(time);
}

int MaybeWait(unsigned long time) {
    BP_NOT_USED(time);
    return OK;
}

/* ============================================================
 * MIDIstuff.c stubs
 * ============================================================ */

int FormatMIDIstream(MIDIcode **p_b, long imax, MIDIcode **p_c, int zerostart,
    long im2, long *p_nbytes, int filter) {
    BP_NOT_USED(p_b); BP_NOT_USED(imax); BP_NOT_USED(p_c); BP_NOT_USED(zerostart);
    BP_NOT_USED(im2); BP_NOT_USED(p_nbytes); BP_NOT_USED(filter);
    return OK;
}

int MIDItoPrototype(int zerostart, int filter, int j, MIDIcode **p_b, long imax) {
    BP_NOT_USED(zerostart); BP_NOT_USED(filter); BP_NOT_USED(j);
    BP_NOT_USED(p_b); BP_NOT_USED(imax);
    return OK;
}

int SendToDriver(int a, int b, int c, Milliseconds d, int e,
                 int* f, MIDI_Event* g) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    BP_NOT_USED(d); BP_NOT_USED(e); BP_NOT_USED(f); BP_NOT_USED(g);
    return OK;
}

int CaptureMidiEvent(Milliseconds time, int nseq, MIDI_Event *p_e) {
    BP_NOT_USED(time); BP_NOT_USED(nseq); BP_NOT_USED(p_e);
    return OK;
}

int CleanUpBuffer(void) {
    return OK;
}

/* ============================================================
 * MIDIfiles.c stubs
 * ============================================================ */

int ResetMIDIfile(void) {
    return OK;
}

int CloseMIDIFile(void) {
    return OK;
}

int ChannelConvert(int ch) {
    return ch;
}

int AllNotesOffAllChannels(int force) {
    BP_NOT_USED(force);
    return OK;
}

int AllControlsOffAllChannels(int force) {
    BP_NOT_USED(force);
    return OK;
}

int ReadMIDIfile(int* p_result) {
    BP_NOT_USED(p_result);
    return MISSED;
}

int PrepareMIDIFile(void) {
    return OK;
}

int FadeOut(void) {
    return OK;
}

int ImportMIDIfile(int w) {
    BP_NOT_USED(w);
    return MISSED;
}

int NewTrack(void) {
    return OK;
}

int ClipVelocity(int a, int b, int c, int d) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c); BP_NOT_USED(d);
    return OK;
}

int WaitForLastSounds(long delay) {
    BP_NOT_USED(delay);
    return OK;
}

int MakeMIDIFile(OutFileInfo* finfo) {
    BP_NOT_USED(finfo);
    return OK;
}

/* ============================================================
 * PlayThings.c stubs
 * ============================================================ */

int PlaySelection(int w, int all) {
    BP_NOT_USED(w); BP_NOT_USED(all);
    BPPrintMessage(0, odWarning, "PlaySelection() not available in WASM build\n");
    return OK;
}

int ExpandSelection(int w) {
    BP_NOT_USED(w);
    BPPrintMessage(0, odWarning, "ExpandSelection() not available in WASM build\n");
    return OK;
}

int ChangedProtoType(int j) {
    /* Stub: in native, updates UI when a prototype changes.
       In WASM, nothing to do — no UI to update. */
    BP_NOT_USED(j);
    return OK;
}

int PlayBuffer(tokenbyte ***pp_buff, int onlypianoroll) {
    int r;
    int savedPanic;

    if(Panic || CheckEmergency() != OK) return(ABORT);
    if(Jbol < 3) NoAlphabet = TRUE;
    else NoAlphabet = FALSE;

    /* Save Panic state — WASM PlayBuffer must not propagate ABORT
       from MIDI extraction failures to the text production pipeline */
    savedPanic = Panic;

    if(FirstTime && !onlypianoroll) {
        if(p_Initbuff == NULL) {
            return(OK); /* Graceful: no init buffer, skip MIDI */
        }
        r = PlayBuffer1(&p_Initbuff, NO);
        if(r != OK) {
            Panic = savedPanic; /* Restore */
            return(OK); /* Don't abort production */
        }
        FirstTime = FALSE;
    }
    r = PlayBuffer1(pp_buff, onlypianoroll);
    if(!PlaySelectionOn && ItemNumber > INT_MAX) ItemNumber = 1L;

    /* In WASM non-Improvize mode, don't let MIDI extraction failure abort
       text production. But in Improvize mode, ABORT from PlayBuffer is the
       normal signal to stop the loop — propagate it. */
    if(!Improvize && (r == ABORT || r == EXIT)) {
        Panic = savedPanic;
        r = OK;
    }
    return(r);
}

int PlayBuffer1(tokenbyte ***pp_buff, int onlypianoroll) {
    int result, nmax, k, j;
    long tmin, tmax, kmax, length;
    unsigned long maxseq;
    double maxseqapprox;
    unsigned long **p_imaxseq;
    tokenbyte **p_b;

    length = LengthOf(pp_buff);
    emscripten_log(EM_LOG_CONSOLE, "PlayBuffer1: length=%ld", length);
    if(length < 1) return(OK);
    CurrentChannel = 1;

    /* Store item for later restoration */
    p_b = NULL;
    int store = FALSE;
    if(!Improvize && !PlaySelectionOn && !onlypianoroll) store = TRUE;
    if(store) {
        if((p_b = (tokenbyte**)GiveSpace((Size)MyGetHandleSize((Handle)*pp_buff))) == NULL)
            return(ABORT);
        if(CopyBuf(pp_buff, &p_b) == ABORT) return(ABORT);
    }

    result = OK;
    ShowMessages = TRUE;

    /* PolyMake: resolve polymetric expressions */
    emscripten_log(EM_LOG_CONSOLE, "PlayBuffer1: calling PolyMake...");
    while((result = PolyMake(pp_buff, &maxseqapprox, YES)) == AGAIN) {};
    emscripten_log(EM_LOG_CONSOLE, "PlayBuffer1: PolyMake result=%d", result);
    if(result == EMPTY) { result = OK; goto SORTIR; }
    if(result != OK) {
        result = OK; goto SORTIR;
    }

    /* Allocate event space */
    emscripten_log(EM_LOG_CONSOLE, "PlayBuffer1: calling MakeEventSpace...");
    if((result = MakeEventSpace(&p_imaxseq)) != OK) {
        emscripten_log(EM_LOG_CONSOLE, "PlayBuffer1: MakeEventSpace FAILED");
        result = OK; goto SORTIR;
    }

    /* Check prototypes */
    if((result = CheckLoadedPrototypes()) != OK) {
        goto RELEASE;
    }

    /* Debug: verify p_MIDIsize before TimeSet */
    {
        int dbg;
        for(dbg = 2; dbg < Jbol && dbg < 20; dbg++) {
            if((*p_MIDIsize)[dbg] > 0)
                emscripten_log(EM_LOG_CONSOLE, "pre-TimeSet: p_Bol[%d] MIDIsize=%ld Dur=%ld",
                    dbg, (long)(*p_MIDIsize)[dbg], (long)(*p_Dur)[dbg]);
        }
    }

    /* Guard: check for T4 (unresolved variable) tokens in the expanded buffer.
       FillPhaseDiagram (called by TimeSet) converts T4 tokens to silent
       sound-objects (code added 2026-03-20 in Bernard's FillPhaseDiagram.c:622).
       This conversion can corrupt the phase diagram when combined with
       polymetric expressions + _legato/_staccato, causing SetTimeObjects
       to crash with memory access out of bounds.
       This happens when NoteConvention mismatches the grammar (e.g. French
       convention with English note names like C4, D4 — not recognized as
       notes, stored as T4 variables).
       Must scan AFTER PolyMake since polymetric expansion changes the buffer. */
    {
        long expanded_len = MyGetHandleSize((Handle)*pp_buff) / sizeof(tokenbyte);
        long scan;
        int has_vars = FALSE;
        for(scan = 0; scan < expanded_len; scan += 2) {
            if((**pp_buff)[scan] == 4) { /* T4 = unresolved variable */
                has_vars = TRUE;
                break;
            }
        }
        if(has_vars) {
            emscripten_log(EM_LOG_CONSOLE,
                "PlayBuffer1: buffer contains T4 (variable) tokens — "
                "skipping TimeSet to avoid FillPhaseDiagram crash");
            result = OK;
            goto SORTIR;
        }
    }

    /* Remember where this item's events start (for dedup within this item only) */
    long eventCountAtItemStart = eventCount;

    /* Match native MakeSound behavior: increment ItemNumber when writing MIDI.
       In native, MakeSound.c:130 does ItemNumber++ when MIDIfileOn=TRUE.
       This is IN ADDITION to the ItemNumber++ in ProduceItems.c:283 (Improvize loop).
       Without this, the WASM Improvize loop runs 2x more items than native. */
    if(WriteMIDIfile && !rtMIDI) ItemNumber++;

    /* TimeSet: compute start/end times for all sound objects */
    SetTimeOn = TRUE; nmax = 0;
    result = TimeSet(pp_buff, &kmax, &tmin, &tmax, &maxseq, &nmax, p_imaxseq, maxseqapprox);
    wasm_last_kmax = kmax;
    emscripten_log(EM_LOG_CONSOLE, "PlayBuffer1: TimeSet result=%d kmax=%ld nmax=%d", result, kmax, nmax);
    for(k = 2; k <= kmax; k++) {
        emscripten_log(EM_LOG_CONSOLE, "  p_Instance[%ld] obj=%d start=%ld end=%ld",
            k, (*p_Instance)[k].object, (long)(*p_Instance)[k].starttime, (long)(*p_Instance)[k].endtime);
    }
    SetTimeOn = FALSE;
    if(result != OK && result != AGAIN) {
        /* WASM: graceful fallback — no MIDI events but don't abort */
        goto RELEASE;
    }
    result = OK;

    /* === WASM: Extract MIDI events from p_Instance into eventStack === */
    if(p_Instance != NULL && eventStack != NULL) {
        for(k = 2; k <= kmax; k++) {
            j = (*p_Instance)[k].object;
            if(j < 2) continue;  /* Skip silences/markers */

            int midiKey;
            if(j >= 16384) {
                /* Simple note (T25): MIDI key encoded as object - 16384 */
                midiKey = j - 16384;
            } else {
                /* Complex sound object — skip for now */
                continue;
            }

            if(midiKey < 0 || midiKey > 127) continue;

            Milliseconds startMs = (*p_Instance)[k].starttime;
            Milliseconds endMs = (*p_Instance)[k].endtime;
            int vel = (*p_Instance)[k].velocity;
            int chan = (*p_Instance)[k].channel;
            int scale = (*p_Instance)[k].scale;

            if(vel <= 0) vel = 64;
            if(vel > 127) vel = 127;
            if(chan < 1) chan = 1;
            if(chan > 16) chan = 16;

            /* Deduplicate: skip if same note+time+channel already emitted.
               p_Instance contains entries for ALL polymetric sequences (nmax).
               The same note at the same time appears once per sequence.
               Native MakeSound iterates differently and emits each note once. */
            {
                int dup = FALSE;
                long ec;
                for(ec = eventCountAtItemStart; ec < eventCount; ec++) {
                    if((eventStack[ec].status & 0xF0) == NoteOn
                       && eventStack[ec].time == startMs
                       && eventStack[ec].data1 == (unsigned char)midiKey) {
                        dup = TRUE; break;
                    }
                }
                if(dup) continue;
            }

            /* NoteOn event */
            if(eventCount < eventCountMax) {
                eventStack[eventCount].time = startMs;
                eventStack[eventCount].type = RAW_EVENT;
                eventStack[eventCount].status = NoteOn | ((chan - 1) & 0x0F);
                eventStack[eventCount].data1 = (unsigned char)midiKey;
                eventStack[eventCount].data2 = (unsigned char)vel;
                eventStack[eventCount].instance = k;
                eventStack[eventCount].scale = scale;
                eventCount++;
            }

            /* NoteOff event */
            if(eventCount < eventCountMax) {
                eventStack[eventCount].time = endMs;
                eventStack[eventCount].type = RAW_EVENT;
                eventStack[eventCount].status = NoteOff | ((chan - 1) & 0x0F);
                eventStack[eventCount].data1 = (unsigned char)midiKey;
                eventStack[eventCount].data2 = 0;
                eventStack[eventCount].instance = k;
                eventStack[eventCount].scale = scale;
                eventCount++;
            }
        }
    }

RELEASE:
    ReleasePhaseDiagram(nmax, &p_imaxseq);

SORTIR:
    if(store) {
        if(CopyBuf(&p_b, pp_buff) == ABORT) return(ABORT);
        MyDisposeHandle((Handle*)&p_b);
    }
    return(result);
}

int PlayHandle(char** h, int w) {
    BP_NOT_USED(h); BP_NOT_USED(w);
    return OK;
}

int ShowPeriods(int w) {
    BP_NOT_USED(w);
    return OK;
}

/* AnalyzeSelection is defined in ProduceItems.c */

/* ============================================================
 * MakeSound.c stubs
 * ============================================================ */

int MakeSound(long* a, unsigned long b, int c, tokenbyte*** d,
              long e, long f, int g, Milliseconds** h) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c); BP_NOT_USED(d);
    BP_NOT_USED(e); BP_NOT_USED(f); BP_NOT_USED(g); BP_NOT_USED(h);
    return OK;
}

int InterruptSound(void) {
    return OK;
}

/* ============================================================
 * Graphic.c stubs
 * ============================================================ */

int HasGWorlds(void) {
    return 0;
}

int DrawNoteScale(Rect* r, int a, int b, int c, int d, int e, int f) {
    BP_NOT_USED(r); BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    BP_NOT_USED(d); BP_NOT_USED(e); BP_NOT_USED(f);
    return OK;
}

int DrawPianoNote(char* s, int a, int b, Milliseconds c, Milliseconds d,
                  int e, int f, int g, int h, int i, Rect* r) {
    BP_NOT_USED(s); BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    BP_NOT_USED(d); BP_NOT_USED(e); BP_NOT_USED(f); BP_NOT_USED(g);
    BP_NOT_USED(h); BP_NOT_USED(i); BP_NOT_USED(r);
    return OK;
}

long Findibm(int a, Milliseconds b, int c) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    return 0L;
}

int DrawItemBackground(Rect* r, unsigned long a, int b, int c, int d, int e,
                        Milliseconds** f, long* g, int h, int* i, char* j) {
    BP_NOT_USED(r); BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    BP_NOT_USED(d); BP_NOT_USED(e); BP_NOT_USED(f); BP_NOT_USED(g);
    BP_NOT_USED(h); BP_NOT_USED(i); BP_NOT_USED(j);
    return OK;
}

double GetTableValue(double a, long b, Coordinates** c, double d, double e) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    BP_NOT_USED(d); BP_NOT_USED(e);
    return 0.0;
}

double ContinuousParameter(Milliseconds a, int b, ControlStream** c) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    return 0.0;
}

int GetPartOfTable(XYgraph* a, double b, double c, long d, Coordinates** e) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    BP_NOT_USED(d); BP_NOT_USED(e);
    return OK;
}

int MakeCsoundFunctionTable(int a, double** b, double c, double d,
                             long e, Coordinates** f, int g, int h,
                             int i, int j, int k) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c); BP_NOT_USED(d);
    BP_NOT_USED(e); BP_NOT_USED(f); BP_NOT_USED(g); BP_NOT_USED(h);
    BP_NOT_USED(i); BP_NOT_USED(j); BP_NOT_USED(k);
    return OK;
}

double CombineScoreValues(double a, double b, double c, double d,
                           double e, int f, int g, int h) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c); BP_NOT_USED(d);
    BP_NOT_USED(e); BP_NOT_USED(f); BP_NOT_USED(g); BP_NOT_USED(h);
    return 0.0;
}

int GetGENtype(int a, int b, int c) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    return 0;
}

double Remap(double val, int a, int b, int* c) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    return val;
}

int WaitForEmptyBuffer(void) {
    return OK;
}

/* ============================================================
 * Csound.c / CsoundMaths.c / CsoundScoreMake.c stubs
 * ============================================================ */

int CompileCsoundObjects(void) {
    return OK;
}

int FindCsoundInstrument(char* name) {
    BP_NOT_USED(name);
    return MISSED;
}

int ResetMIDIFilter(void) {
    return OK;
}

int ResetCsoundInstrument(int a, int b, int c) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    return OK;
}

int ResetMoreParameter(int j, int ip) {
    BP_NOT_USED(j); BP_NOT_USED(ip);
    return OK;
}

/* FindScale() — Real implementation from MIDIstuff.c (Bernard Bel)
   Searches Scale[] array for a scale whose label matches the string constant. */
int FindScale(int scale) {
    int i_scale, result;
    if(scale < 0) return(-1);
    if(scale == 0) { i_scale = 0; return i_scale; } /* Equal-tempered */
    /* 'scale' is the index of its name in StringConstant */
    for(i_scale = 1; i_scale <= NumberScales; i_scale++) {
        result = MyHandlecmp((*p_StringConstant)[scale], (*Scale)[i_scale].label);
        if(result == 0) break;
    }
    return i_scale;
}

/* FixStringConstant and FixNumberConstant are defined in Misc.c */

int CompileRegressions(void) {
    return OK;
}

int CompileObjectScore(int a, int* b) {
    BP_NOT_USED(a); BP_NOT_USED(b);
    return OK;
}

int SetInputFilterWord(int a) {
    BP_NOT_USED(a);
    return OK;
}

int SetOutputFilterWord(int a) {
    BP_NOT_USED(a);
    return OK;
}

int GetInputFilterWord(int a) {
    BP_NOT_USED(a);
    return 0;
}

int GetOutputFilterWord(int a) {
    BP_NOT_USED(a);
    return 0;
}

/* LoadCsoundInstruments is defined in SaveLoads1.c */

int CscoreWrite(Rect* r, int a, int b, int c, int d, int e, int f,
                int g, double h, Milliseconds i, int j, int k, int l,
                int m, int n, int o, int p, int q, PerfParameters**** pp,
                int s, int t) {
    BP_NOT_USED(r); BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    BP_NOT_USED(d); BP_NOT_USED(e); BP_NOT_USED(f); BP_NOT_USED(g);
    BP_NOT_USED(h); BP_NOT_USED(i); BP_NOT_USED(j); BP_NOT_USED(k);
    BP_NOT_USED(l); BP_NOT_USED(m); BP_NOT_USED(n); BP_NOT_USED(o);
    BP_NOT_USED(p); BP_NOT_USED(q); BP_NOT_USED(pp); BP_NOT_USED(s);
    BP_NOT_USED(t);
    return OK;
}

int FixCsoundScoreName(char* s) {
    BP_NOT_USED(s);
    return OK;
}

int Findabc(double*** a, int b, regression* c) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    return OK;
}

int GetRegressions(int a) {
    BP_NOT_USED(a);
    return OK;
}

double XtoY(double x, regression* r, int* err, int mode) {
    BP_NOT_USED(r); BP_NOT_USED(err); BP_NOT_USED(mode);
    return x;
}

double YtoX(double y, regression* r, int* err, int mode) {
    BP_NOT_USED(r); BP_NOT_USED(err); BP_NOT_USED(mode);
    return y;
}

/* ============================================================
 * Script.c / ScriptUtils.c stubs
 * ============================================================ */

int ExecScriptLine(char*** h, int a, int b, int c, char** d,
                   long e, long* f, int* g, int* h2) {
    BP_NOT_USED(h); BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    BP_NOT_USED(d); BP_NOT_USED(e); BP_NOT_USED(f); BP_NOT_USED(g);
    BP_NOT_USED(h2);
    return OK;
}

int DoScript(int a, char*** b, int c, int d, int e, long* f,
             int* g, char* h, int i) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c); BP_NOT_USED(d);
    BP_NOT_USED(e); BP_NOT_USED(f); BP_NOT_USED(g); BP_NOT_USED(h);
    BP_NOT_USED(i);
    return OK;
}

int ExecuteScriptList(p_list** list) {
    BP_NOT_USED(list);
    return OK;
}

int InterruptScript(void) {
    return OK;
}

/* ============================================================
 * HTML.c stubs
 * ============================================================ */

int CheckHTML(int a, int b, char** c, long* d, int* e) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    BP_NOT_USED(d); BP_NOT_USED(e);
    return OK;
}

int DOStoMac(char* s) {
    BP_NOT_USED(s);
    return OK;
}

int MacToHTML(int a, char*** b, int c) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c);
    return OK;
}

/* ============================================================
 * Note resolution — Real implementations from MIDIstuff.c (Bernard Bel)
 * ============================================================ */

/* GetThisNote() — Real implementation from MIDIstuff.c (Bernard Bel)
   Resolves note name + octave to MIDI key number using the current NoteConvention. */
int GetThisNote(char* line, int* p_thekey, int* p_channel, int ignorechannel) {
    char *p, *q, line2[MAXLIN];
    int i, j, pitchclass, octave, l;

    i = j = 0;
    while(MySpace(line[i])) i++;
    strcpy(line2, line);

    if(NoteConvention == KEYS) {
        while(line[i] != '\0' && line[i] == KeyString[j]) {
            i++; j++;
        }
        if(KeyString[j] != '\0') return(MISSED);
        *p_thekey = GetInteger(YES, line2, &i);
        if(*p_thekey == INT_MAX) return(MISSED);
    }
    else {
        for(pitchclass = 0; pitchclass < 12; pitchclass++) {
            p = &line2[i];
            switch(NoteConvention) {
                case FRENCH: {
                    q = &Frenchnote[pitchclass][0]; l = strlen(Frenchnote[pitchclass]);
                    if(l > 0 && Match(TRUE, &p, &q, l) && isdigit(p[l])) goto CONT;
                    p = &line2[i];
                    q = &AltFrenchnote[pitchclass][0]; l = strlen(AltFrenchnote[pitchclass]);
                    if(l > 0 && Match(TRUE, &p, &q, l) && isdigit(p[l])) goto CONT;
                    break;
                }
                case ENGLISH: {
                    q = &Englishnote[pitchclass][0]; l = strlen(Englishnote[pitchclass]);
                    if(l > 0 && Match(TRUE, &p, &q, l) && isdigit(p[l])) goto CONT;
                    p = &line2[i];
                    q = &AltEnglishnote[pitchclass][0]; l = strlen(AltEnglishnote[pitchclass]);
                    if(l > 0 && Match(TRUE, &p, &q, l) && isdigit(p[l])) goto CONT;
                    break;
                }
                case INDIAN:
                    q = &Indiannote[pitchclass][0]; l = strlen(Indiannote[pitchclass]);
                    if(l > 0 && Match(TRUE, &p, &q, l) && isdigit(p[l])) goto CONT;
                    p = &line2[i];
                    q = &AltIndiannote[pitchclass][0]; l = strlen(AltIndiannote[pitchclass]);
                    if(l > 0 && Match(TRUE, &p, &q, l) && isdigit(p[l])) goto CONT;
                    break;
            }
        }
        return(MISSED);

    CONT:
        while(!isdigit(line[i]) && line[i] != '\0') i++;
        if(NoteConvention == FRENCH) {
            if(line[i] == '0' && line[i+1] == '0' && line[i+2] == '0') {
                octave = 0; i += 3;
                goto CONT2;
            }
            if(line[i] == '0' && line[i+1] == '0') {
                octave = 1; i += 2;
                goto CONT2;
            }
        }
        if(NoteConvention == ENGLISH || NoteConvention == INDIAN) {
            if(line[i] == '0' && line[i+1] == '0') {
                octave = 0; i += 2;
                goto CONT2;
            }
        }
        if((octave = GetInteger(YES, line2, &i)) == INT_MAX) return(MISSED);
        if(NoteConvention == FRENCH) octave += 2;
        if(NoteConvention == ENGLISH || NoteConvention == INDIAN) octave++;

    CONT2:
        *p_thekey = 12 * octave + pitchclass;
        *p_thekey += (C4key - 60);
    }

    if(ignorechannel) return(OK);
    while(MySpace(line[i])) i++;
    strcpy(Message, "channel");
    p = &line2[i]; q = &(Message[0]);
    if(!Match(FALSE, &p, &q, strlen(Message))) return(MISSED);
    while(!isdigit(line[i]) && line[i] != '\0') i++;
    if((*p_channel = GetInteger(YES, line2, &i)) == INT_MAX) return(MISSED);
    return(OK);
}

/* PrintThisNote() — Real implementation from MIDIstuff.c (Bernard Bel)
   Converts MIDI key number back to note name string. */
int PrintThisNote(int i_scale, int key, int channel, int wind, char* line) {
    int pitchclass, octave;
    char channelstring[20];
    (void)wind;

    if(key < 0) {
        strcpy(line, "<void>");
        return(OK);
    }
    channelstring[0] = '\0';
    if(channel > 0) my_sprintf(channelstring, " channel %ld", (long)channel);

    if(i_scale > NumberScales) {
        BPPrintMessage(0, odError, "=> Error: i_scale (%ld) > NumberScales (%d)\n", (long)i_scale, NumberScales);
        return(OK);
    }

    if(i_scale > 0) {
        int keyclass;
        int basekey = (*Scale)[i_scale].basekey;
        int numgrades = (*Scale)[i_scale].numgrades;
        int numnotes = (*Scale)[i_scale].numnotes;
        int baseoctave = (*Scale)[i_scale].baseoctave;
        if(numgrades <= 12) {
            keyclass = modulo(key - basekey, numgrades);
            octave = baseoctave + floor(((double)key - basekey) / numgrades);
        }
        else {
            int i_note = modulo(key - basekey, numnotes);
            keyclass = (*((*Scale)[i_scale].keyclass))[i_note];
            octave = baseoctave + floor((((double)key - basekey)) / numnotes);
        }
        my_sprintf(line, "%s%d%s", *((*(*Scale)[i_scale].notenames)[keyclass]), octave, channelstring);
    }
    else {
        pitchclass = modulo((key - C4key), 12);
        octave = (key - pitchclass) / 12;
        if(NameChoice[pitchclass] == 1 && pitchclass == 0) octave--;
        if(NameChoice[pitchclass] == 1 && pitchclass == 11) octave++;
        switch(NoteConvention) {
            case FRENCH:
                octave -= 2;
                switch(octave) {
                    case -2:
                        if(NameChoice[pitchclass] == 0)
                            my_sprintf(line, "%s000%s", Frenchnote[pitchclass], channelstring);
                        else
                            my_sprintf(line, "%s000%s", AltFrenchnote[pitchclass], channelstring);
                        break;
                    case -1:
                        if(NameChoice[pitchclass] == 0)
                            my_sprintf(line, "%s00%s", Frenchnote[pitchclass], channelstring);
                        else
                            my_sprintf(line, "%s00%s", AltFrenchnote[pitchclass], channelstring);
                        break;
                    default:
                        if(NameChoice[pitchclass] == 0)
                            my_sprintf(line, "%s%ld%s", Frenchnote[pitchclass], (long)octave, channelstring);
                        else
                            my_sprintf(line, "%s%ld%s", AltFrenchnote[pitchclass], (long)octave, channelstring);
                        break;
                }
                break;
            case ENGLISH:
                octave--;
                switch(octave) {
                    case -1:
                        if(NameChoice[pitchclass] == 0)
                            my_sprintf(line, "%s00%s", Englishnote[pitchclass], channelstring);
                        else
                            my_sprintf(line, "%s00%s", AltEnglishnote[pitchclass], channelstring);
                        break;
                    default:
                        if(NameChoice[pitchclass] == 0)
                            my_sprintf(line, "%s%ld%s", Englishnote[pitchclass], (long)octave, channelstring);
                        else
                            my_sprintf(line, "%s%ld%s", AltEnglishnote[pitchclass], (long)octave, channelstring);
                        break;
                }
                break;
            case INDIAN:
                octave--;
                switch(octave) {
                    case -1:
                        if(NameChoice[pitchclass] == 0)
                            my_sprintf(line, "%s00%s", Indiannote[pitchclass], channelstring);
                        else
                            my_sprintf(line, "%s00%s", AltIndiannote[pitchclass], channelstring);
                        break;
                    default:
                        if(NameChoice[pitchclass] == 0)
                            my_sprintf(line, "%s%ld%s", Indiannote[pitchclass], (long)octave, channelstring);
                        else
                            my_sprintf(line, "%s%ld%s", AltIndiannote[pitchclass], (long)octave, channelstring);
                        break;
                }
                break;
            default:
                my_sprintf(line, "%s%ld%s", KeyString, (long)key, channelstring);
                break;
        }
    }
    trim_digits_after_key_hash(line);
    return(OK);
}

/* ============================================================
 * SendControl stub (MakeSound.c)
 * ============================================================ */

int SendControl(ContinuousControl** a, Milliseconds b, int c, int d,
                int e, int f, int g, int* h, char*** i,
                Milliseconds*** j, int*** k, MIDIcontrolstatus** l,
                PerfParameters**** m) {
    BP_NOT_USED(a); BP_NOT_USED(b); BP_NOT_USED(c); BP_NOT_USED(d);
    BP_NOT_USED(e); BP_NOT_USED(f); BP_NOT_USED(g); BP_NOT_USED(h);
    BP_NOT_USED(i); BP_NOT_USED(j); BP_NOT_USED(k); BP_NOT_USED(l);
    BP_NOT_USED(m);
    return OK;
}

/* ============================================================
 * Buffer functions extracted from PlayThings.c (essential for
 * grammar compilation and production)
 * ============================================================ */

long LengthOf(tokenbyte ***pp_X) {
    if(*pp_X == NULL) return -1L;
    size_t imax = MyGetHandleSize((Handle)*pp_X) / sizeof(tokenbyte);
    tokenbyte *tokens = **pp_X;
    long i = 0;
    while (i < (long)imax - 1) {
        if(tokens[i] == TEND && tokens[i + 1] == TEND) return i;
        i++;
    }
    return -1L;
}

long CopyBuf(tokenbyte ***pp_X, tokenbyte ***pp_Y) {
    long length;
    Size blocksize, maxsize, oldsize;
    tokenbyte *ptr1, *ptr2;

    length = LengthOf(pp_X);
    blocksize = (length + 2L) * sizeof(tokenbyte);
    if(*pp_X == NULL) {
        BPPrintMessage(0, odError, "=> Err. CopyBuf(). *pp_X = NULL");
        return(ABORT);
    }
    maxsize = oldsize = MyGetHandleSize((Handle)*pp_X);
    if(maxsize <= blocksize) {
        BPPrintMessage(0, odError, "=> Err. CopyBuf(). maxsize (%ld) <= blocksize (%ld)\n",
                       (long)maxsize, (long)blocksize);
        return(ABORT);
    }
    if((*pp_Y) == NULL) {
        BPPrintMessage(0, odError, "=> Err. CopyBuf(). *pp_Y = NULL\n");
        return(ABORT);
    }
    maxsize = oldsize = MyGetHandleSize((Handle)*pp_Y);
    if(maxsize <= blocksize) {
        maxsize = (blocksize * 3L) / 2L;
        MemoryUsed += (maxsize - oldsize);
        if(MemoryUsed > MaxMemoryUsed) {
            MaxMemoryUsed = MemoryUsed;
        }
        if(MySetHandleSize((Handle*)pp_Y, maxsize) != OK) return(ABORT);
    }
    ptr1 = &(**pp_X)[0]; ptr2 = &(**pp_Y)[0];
    memmove(ptr2, ptr1, blocksize);
    return(length);
}

int SelectionToBuffer(int sequence, int noreturn, int w, tokenbyte ***pp_X,
    long *p_end, int mode) {
    char c, *p1, *p2, **ptr, **p_buff, ***pp_buff;
    p_context *p_plx, *p_prx;
    int i, notargument, meta=0, jbolmem, rep, ret;
    long origin, end, length;
    tokenbyte **p_ti;

    BP_NOT_USED(mode);
    if(!CompiledPt) {
        if((rep=CompilePatterns()) != OK) return(rep);
    }
    rep = MISSED;
    MyDisposeHandle((Handle*)pp_X);
    pp_buff = &p_buff; p_buff = NULL;
    if(!Editable[w]) return(MISSED);
    TextGetSelection(&origin, &end, TEH[w]);
    *p_end = end;
    SelectOn = TRUE;

POSITION:
    while(MySpace(c=GetTextChar(w, origin))) {
        origin++;
        if(origin == end) { SelectOn = FALSE; return(MISSED); }
        if(origin > end) {
            SelectOn = FALSE;
            BPPrintMessage(0, odError, "=> SelectionToBuffer error 1, origin = %ld, end = %ld\n", origin, end);
            return(MISSED);
        }
    }
    if(GetTextChar(w, origin) == '[') {
        while((c=GetTextChar(w, origin)) != ']') {
            origin++;
            if(origin >= end) {
                SelectOn = FALSE;
                Panic = TRUE;
                BPPrintMessage(0, odError, "=> SelectionToBuffer error 2, can't find ']'\n");
                return(MISSED);
            }
        }
        origin++; goto POSITION;
    }
    if(origin >= end) {
        SelectOn = FALSE;
        BPPrintMessage(0, odError, "=> SelectionToBuffer error 3, origin = %ld, end = %ld\n", origin, end);
        return(MISSED);
    }
    length = end - origin + 4L;
    if((ptr = (char**) GiveSpace((Size)(length * sizeof(char)))) == NULL) {
        rep = ABORT;
        BPPrintMessage(0, odError, "=> Err. SelectionToBuffer(). ptr == NULL");
        goto SORTIR;
    }
    *pp_buff = ptr;
    if(ReadToBuff(YES, noreturn, w, &origin, end, pp_buff) != OK) goto BAD;

    *p_end = origin;
    p1 = **pp_buff; p2 = p1; i = 0; ret = FALSE;
    while(((*p2) != '\0') && (ret || (*p2) != '\r')) {
        if(!MySpace((*p2))) ret = FALSE;
        p2++;
        if(++i > length) {
            BPPrintMessage(0, odError, "=> Err. SelectionToBuffer(). i > length");
            MyDisposeHandle((Handle*)pp_buff);
            SelectOn = FALSE;
            Panic = TRUE;
            return(MISSED);
        }
    }
    if(p1 == p2) {
        MyUnlock((Handle)*pp_buff);
        goto BAD;
    }
    jbolmem = Jbol;
    notargument = TRUE;
    p_plx = NULL; p_prx = NULL;
    p_ti = Encode(&Gram, sequence, notargument, 0, 0, &p1, &p2, p_plx, p_prx, &meta, 0, NULL, FALSE, &rep);
    MyDisposeHandle((Handle*)pp_buff);
    if(p_ti == NULL) {
        SelectOn = FALSE;
        if(EmergencyExit) return(ABORT);
        else {
            if(rep == OK) return(MISSED);
            else return(rep);
        }
    }
    *pp_X = p_ti;
    SelectOn = FALSE;
    return(OK);

BAD:
    MyDisposeHandle((Handle*)pp_buff);

SORTIR:
    if(!ScriptExecOn) {
        BPPrintMessage(0, odError, "No data selected");
    }
    else {
        PrintBehind(wTrace, "No data selected.\n");
    }
    SelectOn = FALSE;
    return(rep);
}

int ReadToBuff(int nocomment, int noreturn, int w, long *p_i, long im, char ***pp_buff) {
    int first;
    long j, size, k, length;
    char c, oldc, **ptr;

    if(*pp_buff == NULL) {
        BPPrintMessage(0, odError, "=> Err. ReadToBuff(). *pp_buff == NULL");
        return(ABORT);
    }
    size = (long) MyGetHandleSize((Handle)*pp_buff);
    size = (long) (size / sizeof(char)) - 1L;
    if(size < 2L) {
        BPPrintMessage(0, odError, "=> Err. ReadToBuff(). size < 2 ");
        return(ABORT);
    }
    if(*p_i >= im) return(MISSED);
    first = TRUE; oldc = '\0';
    if(stop(0, "ReadToBuff") != OK) return ABORT;

    for(j=*p_i, k=0; j < im; j++) {
        c = GetTextChar(w, j);
        if(nocomment && c == '*' && oldc == '/') {
            oldc = '\0'; j++; k--;
            while(TRUE) {
                c = GetTextChar(w, j);
                if(j >= im) { c = '\r'; break; }
                if(c == '/' && oldc == '*') {
                    j++;
                    c = GetTextChar(w, j);
                    break;
                }
                oldc = c;
                j++;
            }
        }
        if(c == '\r') {
            if(first || noreturn) continue;
            else break;
        }
        oldc = c;
        first = FALSE;
        if(noreturn && nocomment && c == '[') { j--; break; }
        c = Filter(c);
        if(c != '\r' || noreturn) (**pp_buff)[k++] = c;
        if(k >= size) {
            if(ThreeOverTwo(&size) != OK) {
                *p_i = ++j;
                if(!ScriptExecOn) BPPrintMessage(0, odError, "Too long paragraph in selection");
                else PrintBehind(wTrace, "Too long paragraph in selection. Aborted.\n");
                return(MISSED);
            }
            ptr = *pp_buff;
            if((ptr = (char**) IncreaseSpace((Handle)ptr)) == NULL) {
                *p_i = ++j;
                return(ABORT);
            }
            *pp_buff = ptr;
        }
    }
    (**pp_buff)[k] = '\0';
    *p_i = ++j;

    length = MyHandleLen(*pp_buff);
    while(length > 0 && ((c=(**pp_buff)[length-1]) == 10 || MySpace(c))) {
        (**pp_buff)[length-1] = '\0';
        length--;
    }
    return(OK);
}

int StartCount(void) {
    return OK;
}

int StopCount(int i) {
    BP_NOT_USED(i);
    return OK;
}
