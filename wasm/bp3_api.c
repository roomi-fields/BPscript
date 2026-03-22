/*  bp3_api.c — Minimal C API for BP3 WASM build
 *
 *  Exposes functions callable from JavaScript via Emscripten's ccall/cwrap.
 *  Captures BP3 output via the BPSetMessageCallback mechanism.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <emscripten.h>

#include "-BP3.h"
#include "-BP3decl.h"

/* Forward declarations for ConsoleMain.c functions */
extern void ConsoleInit(BPConsoleOpts* opts);
extern void ConsoleMessagesInit(void);
extern int LoadSettings(const char *filename, int startup);
extern int LoadTonality(void);
extern int LoadCsoundInstruments(int checkversion, int tryname);

/* ---- Output capture buffers ---- */

#define OUTPUT_BUF_SIZE  (1024 * 1024)   /* 1 MB */
#define MSG_BUF_SIZE     (256 * 1024)    /* 256 KB */

static char  output_buffer[OUTPUT_BUF_SIZE];
static int   output_pos = 0;

static char  message_buffer[MSG_BUF_SIZE];
static int   message_pos = 0;

/* ---- Message callback ---- */

static int wasm_message_callback(void* bp, int dest, const char* format, va_list args) {
    (void)bp;
    char temp[4096];
    int len = vsnprintf(temp, sizeof(temp), format, args);
    if(len < 0) return OK;
    if((size_t)len >= sizeof(temp)) len = sizeof(temp) - 1;

    if(dest & (odDisplay | odCsScore)) {
        /* Production output */
        int remaining = OUTPUT_BUF_SIZE - output_pos - 1;
        if(remaining > 0) {
            int to_copy = len < remaining ? len : remaining;
            memcpy(output_buffer + output_pos, temp, to_copy);
            output_pos += to_copy;
            output_buffer[output_pos] = '\0';
        }
    }

    /* All messages (info, errors, warnings, trace) go to message buffer */
    {
        int remaining = MSG_BUF_SIZE - message_pos - 1;
        if(remaining > 0) {
            int to_copy = len < remaining ? len : remaining;
            memcpy(message_buffer + message_pos, temp, to_copy);
            message_pos += to_copy;
            message_buffer[message_pos] = '\0';
        }
    }

    return OK;
}

/* ---- Exported API ---- */

static int bp3_initialized = 0;

EMSCRIPTEN_KEEPALIVE
int bp3_init(void) {
    output_buffer[0] = '\0';
    output_pos = 0;
    message_buffer[0] = '\0';
    message_pos = 0;

    /* Set up the message callback to capture output */
    BPSetMessageCallback(wasm_message_callback);

    /* Free previous allocations if re-initializing */
    if(bp3_initialized) {
        if(eventStack != NULL) {
            free(eventStack);
            eventStack = NULL;
        }
        /* Reset compilation state so Inits() re-allocates cleanly */
        CompiledGr = FALSE;
        CompiledAl = FALSE;
        CompiledPt = FALSE;
        CompiledIn = FALSE;
        CompiledCsObjects = FALSE;

        /* Reset alphabet counters — prevents contamination from prior grammar */
        Jbol = 0;
        Jfunc = 0;
        iProto = 0;
        Jpatt = 0;
        Jvar = 0;
        Jflag = 0;
        Jhomo = 0;
        N_err = 0;
        BolsInGrammar = 0;
        NoAlphabet = TRUE;

        /* Reset grammar structure */
        MaxGram = 0;
        MaxRul = 0;
        Gram.trueBP = Gram.hasTEMP = Gram.hasproc = FALSE;

        /* Reset scale state */
        NumberScales = 0;
        DefaultScaleParam = -1;

        /* Clear text handles content */
        if(TEH[wGrammar])   CopyStringToTextHandle(TEH[wGrammar], "");
        if(TEH[wAlphabet])  CopyStringToTextHandle(TEH[wAlphabet], "");
        if(TEH[wData])      CopyStringToTextHandle(TEH[wData], "");
        if(TEH[wTrace])     CopyStringToTextHandle(TEH[wTrace], "");

        emscripten_log(EM_LOG_CONSOLE, "bp3_init: re-init (cleaned previous state)");
    }

    /* Replicate essential init from ConsoleMain.c main() */
    MaxHandles = ZERO;
    MemoryUsed = 0;
    MemoryUsedInit = MemoryUsed;
    SkipFlag = FALSE;
    Interactive = FALSE;
    StopPlay = FALSE;
    PausePlay = FALSE;
    TraceMIDIinteraction = FALSE;
    TimeStopped = Oldtimestopped = 0L;
    MIDIsyncDelay = 380;
    DisplayItems = TRUE;

    NoteOffInputFilter = NoteOnInputFilter = KeyPressureInputFilter =
    ControlTypeInputFilter = ProgramTypeInputFilter =
    ChannelPressureInputFilter = PitchBendInputFilter =
    SysExInputFilter = TimeCodeInputFilter = SongPosInputFilter =
    SongSelInputFilter = TuneTypeInputFilter = EndSysExInputFilter =
    ClockTypeInputFilter = StartTypeInputFilter = ContTypeInputFilter =
    ActiveSenseInputFilter = ResetInputFilter = 3;

    LiveGrammar = LiveSettings = TraceLive = ChangedGrammar =
    NewGrammarWaiting = ChangedSettings = SyncChange = FALSE;
    strcpy(LiveFolder, "");

    emscripten_log(EM_LOG_CONSOLE, "bp3_init: ConsoleInit...");
    ConsoleInit(&gOptions);
    ConsoleMessagesInit();

    emscripten_log(EM_LOG_CONSOLE, "bp3_init: Inits()...");
    if(Inits() != OK) {
        emscripten_log(EM_LOG_CONSOLE, "bp3_init: Inits() FAILED");
        return -1;
    }
    emscripten_log(EM_LOG_CONSOLE, "bp3_init: Inits() OK");

    TraceMemory = FALSE;
    MaxMIDIMessages = 1000L;
    eventStack = (MIDI_Event*)malloc(MaxMIDIMessages * sizeof(MIDI_Event));
    if(eventStack == NULL) {
        return -2;
    }

    eventCount = 0L;
    eventCountMax = MaxMIDIMessages - 50L;
    initTime = FirstEventTime = 0L;
    FirstGrammar = TRUE;
    InitOn = FALSE;
    time(&SessionStartTime);
    ProductionTime = ProductionStartTime = PhaseDiagramTime =
    TimeSettingTime = (time_t)0L;
    time(&ProductionStartTime);

    /* Enable MIDI event generation path so PlayBuffer gets called */
    WriteMIDIfile = TRUE;

    /* Reset production state */
    Panic = FALSE;
    EmergencyExit = FALSE;
    NumberMessages = 0;
    Improvize = FALSE;

    ReseedOrShuffle(NEWSEED);
    CopyStringToTextHandle(TEH[wStartString], "S\n");

    /* Call LoadSettings to initialize internal state (memory layout, defaults).
       Without this call, complex grammars (Visser3) crash with SIGSEGV.
       Only on first init — re-init already has the state from previous cycle. */
    if(!bp3_initialized) {
        FILE* f = fopen("/tmp_init_settings.json", "w");
        if(f) {
            fputs("{\"DisplayItems\":{\"name\":\"Display items\",\"value\":\"1\",\"boolean\":\"1\"}}", f);
            fclose(f);
            LoadSettings("/tmp_init_settings.json", FALSE);
            remove("/tmp_init_settings.json");
        }
    }

    bp3_initialized = 1;
    emscripten_log(EM_LOG_CONSOLE, "bp3_init: complete");
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int bp3_load_grammar(const char* text) {
    if(!text) return -1;
    /* Copy grammar text into TEH[wGrammar] */
    CopyStringToTextHandle(TEH[wGrammar], (char*)text);
    /* Force recompilation on next produce */
    CompiledGr = FALSE;
    CompiledAl = FALSE;
    CompiledPt = FALSE;
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int bp3_load_alphabet(const char* text) {
    if(!text) return -1;
    CopyStringToTextHandle(TEH[wAlphabet], (char*)text);
    /* Force recompilation */
    CompiledAl = FALSE;
    return 0;
}

/* bp3_load_settings: kept for backward compatibility but should not be used.
   LoadSettings() expects Bernard's -se format, not arbitrary JSON.
   Use bp3_load_settings_params() instead. */
EMSCRIPTEN_KEEPALIVE
int bp3_load_settings(const char* json_content) {
    if(!json_content || json_content[0] == '\0') return -1;
    FILE* f = fopen("/tmp_settings.json", "w");
    if(!f) return -2;
    fputs(json_content, f);
    fclose(f);
    int r = LoadSettings("/tmp_settings.json", FALSE);
    remove("/tmp_settings.json");
    return (r == OK) ? 0 : -3;
}

/* bp3_load_settings_params: set engine parameters directly without file I/O.
   noteConvention: 0=English, 1=French, 2=Indian, 3=Keys
   quantize: quantization in ms (0 = off)
   timeRes: time resolution in ms
   natureOfTime: 0=smooth, 1=striated
   seed: random seed (0 = don't change)
   maxTime: max computation time in seconds (0 = no limit)
*/
EMSCRIPTEN_KEEPALIVE
int bp3_load_settings_params(int noteConvention, int quantize, int timeRes,
                              int natureOfTime, int seed, int maxTime) {
    NoteConvention = noteConvention;
    Quantize = quantize;
    Time_res = (long)timeRes;
    Nature_of_time = natureOfTime;

    if(seed > 0) {
        Seed = (unsigned)(((long)seed) % 32768L);
        ReseedOrShuffle(seed);
    }

    if(maxTime > 0) MaxConsoleTime = (long)maxTime;
    else MaxConsoleTime = 0;  /* No limit */

    /* Force recompilation since note convention may have changed */
    CompiledGr = FALSE;
    CompiledAl = FALSE;

    return 0;
}

EMSCRIPTEN_KEEPALIVE
int bp3_load_tonality(const char* content) {
    if(!content || content[0] == '\0') return -1;
    /* Write tonality content to virtual filesystem, then call LoadTonality */
    FILE* f = fopen("/tmp_tonality.txt", "w");
    if(!f) return -2;
    fputs(content, f);
    fclose(f);
    strcpy(FileName[wTonality], "/tmp_tonality.txt");
    int r = LoadTonality();
    remove("/tmp_tonality.txt");
    return (r == OK) ? 0 : -3;
}

EMSCRIPTEN_KEEPALIVE
int bp3_load_csound_resources(const char* content) {
    if(!content || content[0] == '\0') return -1;
    /* Write Csound resources to virtual filesystem, then call LoadCsoundInstruments */
    FILE* f = fopen("/tmp_csound.txt", "w");
    if(!f) return -2;
    fputs(content, f);
    fclose(f);
    strcpy(FileName[wCsoundResources], "/tmp_csound.txt");
    int r = LoadCsoundInstruments(0, 1);
    remove("/tmp_csound.txt");
    return (r == OK) ? 0 : -3;
}

EMSCRIPTEN_KEEPALIVE
int bp3_produce(void) {
    int result;

    /* Clear output buffers */
    output_buffer[0] = '\0';
    output_pos = 0;
    message_buffer[0] = '\0';
    message_pos = 0;

    /* Reset state for new production */
    Panic = FALSE;
    EmergencyExit = FALSE;
    NumberMessages = 0;
    eventCount = 0;  /* Clear MIDI events from previous production */

    /* Disable Improvize mode in WASM — no real-time MIDI available.
       Without this, Improvize grammars loop 20+ items then return ABORT. */
    Improvize = FALSE;

    /* Redirect stdout to /dev/null during production to avoid JS stack overflow.
       Every printf/fprintf(stdout) in BP3's C code triggers a WASM→JS syscall (fd_write).
       Deep recursion (Compute.c has 542 printf calls) exhausts the JS call stack.
       Output is captured via the BPPrintMessage callback instead. */
    freopen("/dev/null", "w", stdout);

    emscripten_log(EM_LOG_CONSOLE, "bp3_produce: calling ProduceItems...");
    result = ProduceItems(wStartString, FALSE, FALSE, NULL);
    emscripten_log(EM_LOG_CONSOLE, "bp3_produce: done, result=%d", result);

    freopen("/dev/stdout", "w", stdout);
    return result;
}

EMSCRIPTEN_KEEPALIVE
const char* bp3_get_result(void) {
    /* The production output is written to TEH[OutputWindow] (= TEH[wData])
       via Print(). Read it from the text handle. */
    if(TEH[OutputWindow] != NULL && (*TEH[OutputWindow]) != NULL
       && (*TEH[OutputWindow])->hText != NULL) {
        long len = (*TEH[OutputWindow])->length;
        if(len > 0 && len < OUTPUT_BUF_SIZE - 1) {
            memcpy(output_buffer, (char*)(*(*TEH[OutputWindow])->hText), len);
            output_buffer[len] = '\0';
            return output_buffer;
        }
    }
    /* Also check TEH[wTrace] for trace output */
    if(TEH[wTrace] != NULL && (*TEH[wTrace]) != NULL
       && (*TEH[wTrace])->hText != NULL) {
        long len = (*TEH[wTrace])->length;
        if(len > 0 && len < OUTPUT_BUF_SIZE - 1) {
            memcpy(output_buffer, (char*)(*(*TEH[wTrace])->hText), len);
            output_buffer[len] = '\0';
            return output_buffer;
        }
    }
    return output_buffer;
}

EMSCRIPTEN_KEEPALIVE
const char* bp3_get_messages(void) {
    return message_buffer;
}

/* ---- MIDI event extraction ---- */

#define MIDI_JSON_BUF_SIZE (512 * 1024)
static char midi_json_buffer[MIDI_JSON_BUF_SIZE];

EMSCRIPTEN_KEEPALIVE
const char* bp3_get_midi_events(void) {
    int pos = 0;
    int remaining;
    int written;

    pos += snprintf(midi_json_buffer + pos, MIDI_JSON_BUF_SIZE - pos, "[");

    for(long i = 0; i < eventCount; i++) {
        MIDI_Event *e = &eventStack[i];
        int statusType = e->status & 0xF0;
        int channel = (e->status & 0x0F) + 1;

        remaining = MIDI_JSON_BUF_SIZE - pos - 2; /* reserve space for "]" */
        if(remaining < 120) break; /* safety margin for one JSON object */

        if(i > 0) midi_json_buffer[pos++] = ',';

        written = snprintf(midi_json_buffer + pos, remaining,
            "{\"time\":%ld,\"type\":%d,\"note\":%d,\"velocity\":%d,\"channel\":%d,\"scale\":%d}",
            (long)e->time, statusType, (int)e->data1, (int)e->data2, channel, e->scale);

        if(written > 0 && written < remaining) pos += written;
        else break;
    }

    midi_json_buffer[pos++] = ']';
    midi_json_buffer[pos] = '\0';
    return midi_json_buffer;
}

EMSCRIPTEN_KEEPALIVE
int bp3_get_midi_event_count(void) {
    return (int)eventCount;
}

/* ---- Timed tokens extraction ---- */
/* Correlates text output (all token names including controls, silences)
   with p_Instance[] timing (filled by TimeSet for sounding objects).
   Produces: [{"token":"_vel(80)","start":0,"end":0}, {"token":"C4","start":0,"end":1000}, ...] */

#define TOKEN_JSON_BUF_SIZE (512 * 1024)
static char token_json_buffer[TOKEN_JSON_BUF_SIZE];

/* Escape a string for JSON output */
static int json_escape(char *dst, int maxlen, const char *src, int srclen) {
    int i = 0;
    for(int s = 0; s < srclen && i < maxlen - 2; s++) {
        if(src[s] == '"' || src[s] == '\\') dst[i++] = '\\';
        dst[i++] = src[s];
    }
    dst[i] = '\0';
    return i;
}

extern long wasm_last_kmax;

/* Control token storage for timed_tokens */
typedef struct { const char *start; int len; int after_n; } ControlEntry;
#define MAX_CONTROLS 256
static ControlEntry ctrl_buf[MAX_CONTROLS];

/* Helper: parse text tokens, skip delimiters, handle parentheses */
static const char* next_token(const char *p, const char **tok_start, int *tok_len) {
    while(*p && (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r')) p++;
    if(!*p) return NULL;
    if(*p == '{' || *p == '}' || *p == ',') { *tok_start = NULL; *tok_len = 0; return p + 1; }
    *tok_start = p;
    int pd = 0;
    while(*p) {
        if(*p == '(') pd++;
        else if(*p == ')') { pd--; if(pd <= 0) { p++; break; } }
        else if(pd == 0 && (*p == ' ' || *p == '\t' || *p == '\n' ||
                *p == '\r' || *p == '{' || *p == '}' || *p == ',')) break;
        p++;
    }
    *tok_len = (int)(p - *tok_start);
    return p;
}

EMSCRIPTEN_KEEPALIVE
const char* bp3_get_timed_tokens(void) {
    int pos = 0, remaining, written, count = 0;
    int has_inst, n_controls, sounding_seen, sounding_emitted, ctrl_idx;
    long kmax, k, start_ms, end_ms;
    int j, tl;
    char escaped[512], note_name[64];
    const char *text, *p, *ts, *name;

    pos += snprintf(token_json_buffer + pos, TOKEN_JSON_BUF_SIZE - pos, "[");

    has_inst = (p_Instance != NULL && *p_Instance != NULL && wasm_last_kmax > 1);
    kmax = wasm_last_kmax;
    text = bp3_get_result();

    if(!has_inst) {
        /* No timing data — text-only tokens */
        if(text == NULL || text[0] == '\0') goto FINISH_TOKENS;
        p = text;
        while((p = next_token(p, &ts, &tl)) != NULL) {
            if(ts == NULL || tl <= 0 || tl >= 500) continue;
            remaining = TOKEN_JSON_BUF_SIZE - pos - 2;
            if(remaining < 300) break;
            if(count > 0) token_json_buffer[pos++] = ',';
            json_escape(escaped, sizeof(escaped), ts, tl);
            written = snprintf(token_json_buffer + pos, remaining,
                "{\"token\":\"%s\",\"start\":0,\"end\":0}", escaped);
            if(written > 0 && written < remaining) { pos += written; count++; }
        }
        goto FINISH_TOKENS;
    }

    /* First pass: collect controls from text with their position */
    n_controls = 0;
    sounding_seen = 0;
    if(text != NULL && text[0] != '\0') {
        p = text;
        while((p = next_token(p, &ts, &tl)) != NULL) {
            if(ts == NULL || tl <= 0) continue;
            if(ts[0] == '_' && n_controls < MAX_CONTROLS) {
                ctrl_buf[n_controls].start = ts;
                ctrl_buf[n_controls].len = tl;
                ctrl_buf[n_controls].after_n = sounding_seen;
                n_controls++;
            } else {
                sounding_seen++;
            }
        }
    }

    /* Second pass: iterate p_Instance[2..kmax] and emit tokens with timing.
       object encoding: 0=empty, 1=silence, 2..Jbol=terminal, >=16384=note, -1=end */
    sounding_emitted = 0;
    ctrl_idx = 0;
    long prev_end_ms = 0;
    for(k = 2; k <= kmax; k++) {
        j = (*p_Instance)[k].object;
        if(j == 0) continue;
        if(j == -1) break;

        start_ms = (long)(*p_Instance)[k].starttime;
        end_ms = (long)(*p_Instance)[k].endtime;

        /* Detect silence gaps: if this object starts after the previous one ended,
           emit a "-" token for the gap. Only for sequential (non-polymetric) tokens. */
        if(start_ms > prev_end_ms && prev_end_ms > 0) {
            remaining = TOKEN_JSON_BUF_SIZE - pos - 2;
            if(remaining < 300) goto FINISH_TOKENS;
            if(count > 0) token_json_buffer[pos++] = ',';
            written = snprintf(token_json_buffer + pos, remaining,
                "{\"token\":\"-\",\"start\":%ld,\"end\":%ld}", prev_end_ms, start_ms);
            if(written > 0 && written < remaining) { pos += written; count++; }
            sounding_emitted++;  /* silence counts as sounding for control positioning */
        }

        /* Emit controls that come before this sounding token */
        while(ctrl_idx < n_controls && ctrl_buf[ctrl_idx].after_n <= sounding_emitted) {
            remaining = TOKEN_JSON_BUF_SIZE - pos - 2;
            if(remaining < 300) goto FINISH_TOKENS;
            if(count > 0) token_json_buffer[pos++] = ',';
            json_escape(escaped, sizeof(escaped), ctrl_buf[ctrl_idx].start, ctrl_buf[ctrl_idx].len);
            written = snprintf(token_json_buffer + pos, remaining,
                "{\"token\":\"%s\",\"start\":%ld,\"end\":%ld}", escaped, start_ms, start_ms);
            if(written > 0 && written < remaining) { pos += written; count++; }
            ctrl_idx++;
        }

        /* Get token name */
        if(j == 1) {
            name = "-";
        } else if(j >= 16384) {
            PrintThisNote((*p_Instance)[k].scale, j - 16384, -1, -1, note_name);
            name = note_name;
        } else if(j > 1 && j < Jbol && p_Bol != NULL && (*p_Bol)[j] != NULL
                  && *((*p_Bol)[j]) != NULL) {
            name = *((*p_Bol)[j]);
        } else {
            name = "?";
        }

        remaining = TOKEN_JSON_BUF_SIZE - pos - 2;
        if(remaining < 300) goto FINISH_TOKENS;
        if(count > 0) token_json_buffer[pos++] = ',';
        json_escape(escaped, sizeof(escaped), name, strlen(name));
        written = snprintf(token_json_buffer + pos, remaining,
            "{\"token\":\"%s\",\"start\":%ld,\"end\":%ld}", escaped, start_ms, end_ms);
        if(written > 0 && written < remaining) { pos += written; count++; }
        sounding_emitted++;
        if(end_ms > prev_end_ms) prev_end_ms = end_ms;
    }

    /* Emit remaining controls */
    while(ctrl_idx < n_controls) {
        remaining = TOKEN_JSON_BUF_SIZE - pos - 2;
        if(remaining < 300) break;
        if(count > 0) token_json_buffer[pos++] = ',';
        json_escape(escaped, sizeof(escaped), ctrl_buf[ctrl_idx].start, ctrl_buf[ctrl_idx].len);
        written = snprintf(token_json_buffer + pos, remaining,
            "{\"token\":\"%s\",\"start\":0,\"end\":0}", escaped);
        if(written > 0 && written < remaining) { pos += written; count++; }
        ctrl_idx++;
    }

FINISH_TOKENS:
    token_json_buffer[pos++] = ']';
    token_json_buffer[pos] = '\0';
    return token_json_buffer;
}

EMSCRIPTEN_KEEPALIVE
int bp3_get_timed_token_count(void) {
    const char *text = bp3_get_result();
    if(text == NULL) return 0;
    int count = 0;
    const char *p = text;
    while(*p) {
        while(*p && (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r')) p++;
        if(!*p) break;
        if(*p == '{' || *p == '}' || *p == ',') { p++; continue; }
        int pd = 0;
        while(*p) {
            if(*p == '(') pd++;
            else if(*p == ')') { pd--; if(pd <= 0) { p++; break; } }
            else if(pd == 0 && (*p == ' ' || *p == '\t' || *p == '\n' ||
                    *p == '\r' || *p == '{' || *p == '}' || *p == ',')) break;
            p++;
        }
        count++;
    }
    return count;
}
