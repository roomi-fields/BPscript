#!/usr/bin/env node
/**
 * Lecteur des réglages BP2 (`-se.*` ancien format) — transcription du lecteur d'origine.
 *
 * SOURCE : bp3-engine/docs-developer/format-se-bp2/ (commit 0b55dab), qui livre
 * `LoadSettings.reference.c` extrait tel quel de `SaveLoads1.c@e9249594` — dernier état
 * avant le passage des réglages au JSON. L'ORDRE des appels `Read*` EST la carte
 * champ → position ; ce fichier en est la transcription fidèle, pas une table devinée.
 *
 * POURQUOI L'ANCIENNE VERSION ÉTAIT FAUSSE : elle supposait UN layout à positions fixes.
 * Il y en a un PAR VERSION, et la structure est en partie AUTO-DESCRIPTIVE :
 *   - `iv`   : indice de version (table VersionName[] de `-BP3main.h`), qui active ou
 *              saute des BLOCS entiers (`if(iv > 5)`, `if(iv > 11)`, `if(iv > 15)`…) ;
 *   - `jmax` : un COMPTEUR lu dans le fichier lui-même, qui conditionne 9 lectures ;
 *   - `wmax` : un COMPTEUR préfixant un tableau de longueur variable.
 * Un lecteur à positions fixes lit donc les bonnes lignes mais les étiquette avec les
 * champs d'une AUTRE version — d'où les valeurs dégénérées (A4freq=10, MaxConsoleTime=1).
 *
 * À NOTER : le lecteur d'origine porte LUI-MÊME des garde-fous de plausibilité
 * (`if(j > 1 && j < 128) C4key = j; else C4key = 60;`). Ils sont reproduits tels quels.
 */

// Table VersionName[] — copiée de csrc/bp3/-BP3main.h via la carte livrée.
const VERSION_NAMES = [
  '-', 'V.2.1', 'V.2.2', 'V.2.3', 'V.2.4', 'V.2.5', 'V.2.5.1', 'V.2.5.2', 'V.2.6',
  'BP2.6.1', 'BP2.6.2', 'BP2.6.3', 'BP2.7', 'BP2.7.1', 'BP2.7.2', 'BP2.7.3', 'BP2.7.4',
  'BP2.8.0', 'BP2.8.1', 'BP2.9.0', 'BP2.9.1', 'BP2.9.2', 'BP2.9.3', 'BP2.9.4', 'BP2.9.5',
  'BP2.9.6beta', 'BP2.9.6', 'BP2.9.7beta', 'BP2.9.8', 'BP2.9.9', 'BP2.999', 'BP3.0',
];
// Recherche du plus long d'abord : 'BP2.9.6beta' doit gagner sur 'BP2.9.6', 'BP2.7.1' sur 'BP2.7'.
const BY_LENGTH = VERSION_NAMES.filter((n) => n !== '-').sort((a, b) => b.length - a.length);

/**
 * Détecte la version et l'indice `iv`. Les fichiers la déclarent de DEUX façons :
 *   - V.2.x  : ligne nue (`V.2.4`), suivie d'une ligne `Date:` — aucune ne commence par //
 *   - BP2.x  : en COMMENTAIRE (`// Bol Processor version BP2.9.3`)
 * Dans les deux cas l'en-tête fait 2 lignes, les valeurs commencent en 3e.
 */
function detectVersion(lines) {
  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const l = (lines[i] || '').trim();
    if (!l) continue;
    for (const name of BY_LENGTH) {
      if (l === name || l.includes(`version ${name}`)) {
        return { iv: VERSION_NAMES.indexOf(name), version: name, headerLines: i + 2 };
      }
    }
  }
  return null;
}

/**
 * Lit un fichier de réglages BP2 et rend un objet { champ: valeur }.
 * Rend `null` si la version est inconnue (on ne devine pas un layout).
 */
function readBP2Settings(content) {
  const raw = content.split(/\r\n?|\n/);
  const ver = detectVersion(raw);
  if (!ver) return null;
  const { iv } = ver;

  let p = ver.headerLines;              // curseur : 1re ligne de VALEUR
  const one = () => { p++; };           // ReadOne : consomme une ligne sans la stocker
  const int = () => { const n = parseInt((raw[p++] || '').trim(), 10); return Number.isNaN(n) ? 0 : n; };
  const flt = () => { const n = parseFloat((raw[p++] || '').trim()); return Number.isNaN(n) ? 0 : n; };

  const o = {};
  int();                                // port série de l'ancien pilote MIDI — ignoré
  one();                                // non utilisé, conservé pour la cohérence

  o.Quantization = int();
  o.Time_res = int();
  o.MIDIsyncDelay = int();
  o.Quantize = int();
  o.Nature_of_time = int();
  o.Pclock = int();
  o.Qclock = int();

  const jmax = int();                   // COMPTEUR lu dans le fichier
  o.Improvize = int();
  o.MaxItemsProduce = int();
  o.UseEachSub = int();
  o.AllItems = int();
  o.DisplayProduce = int();
  int();                                // StepProduce
  o.TraceMicrotonality = int();
  o.TraceProduce = int();
  o.PlanProduce = int();
  o.DisplayItems = int();
  o.ShowGraphic = int();
  o.AllowRandomize = int();
  int(); int(); int();                  // DisplayTimeSet, StepTimeSet, TraceTimeSet
  if (jmax > 27) int();                 // CsoundTrace
  int();                                // rtMIDI
  o.ResetNotes = int();
  o.ComputeWhilePlay = int();
  int();                                // TraceMIDIinteraction
  if (jmax > 19) o.ResetWeights = int();
  if (jmax > 20) o.ResetFlags = int();
  if (jmax > 21) o.ResetControllers = int();
  if (jmax > 22) o.NoConstraint = int();
  if (jmax > 23) int();                 // WriteMIDIfile (forcé par la ligne de commande)
  if (jmax > 24) int();                 // ShowMessages
  if (jmax > 25) int();                 // OutCsound
  if (jmax > 26) int();

  o.SplitTimeObjects = int();
  o.SplitVariables = int();
  int();
  // Normalisations DU LECTEUR D'ORIGINE, reproduites telles quelles : un buffer < 100
  // est ramené à 1000, et le temps de calcul est PLAFONNÉ à 3600 s. C'est ce plafond
  // qui explique la valeur brute 59944 lue ici — elle n'est pas aberrante, elle est
  // simplement bornée par le moteur.
  const buf = int();
  o.DeftBufferSize = buf < 100 ? 1000 : buf;
  int();
  int();                                // UseBufferLimit
  const maxTime = int();
  o.MaxConsoleTime = maxTime > 3600 ? 3600 : maxTime;
  int();
  one();                                // Token
  o.NoteConvention = int();
  int();                                // StartFromOne
  int();
  o.GraphicScaleP = int();
  o.GraphicScaleQ = int();

  one();                                // périphérique OMS d'entrée — ignoré
  if (iv > 5) one();                    // périphérique OMS de sortie — ignoré
  if (iv > 11) int();                   // UseBullet
  if (iv > 7) int();                    // PlayTicks
  if (iv > 10) { int(); int(); }        // FileSaveMode, FileWriteMode
  if (iv > 11) {
    int();                              // MIDIfileType
    int();                              // CsoundFileFormat
    int();                              // ProgNrFrom
    const fade = flt();
    if (iv > 19) o.EndFadeOut = fade;
    // Garde-fou DU LECTEUR D'ORIGINE, reproduit tel quel :
    const c4 = int();
    o.C4key = (c4 > 1 && c4 < 128) ? c4 : 60;
    const a4 = flt();
    o.A4freq = (a4 > 1) ? a4 : 440;
    o.StrikeAgainDefault = int();
  } else {
    o.C4key = 60;
    o.A4freq = 440;
  }
  if (iv > 15) {
    o.DeftVolume = int();
    o.VolumeController = int();
    o.DeftVelocity = int();
    o.DeftPanoramic = int();
    o.PanoramicController = int();
    o.SamplingRate = int();
  }

  const wmax = int();                   // COMPTEUR : tableau de longueur variable
  for (let w = 0; w < wmax - 1; w++) int();
  const blockKey = int();
  o.DefaultBlockKey = (blockKey <= 10 || blockKey > 127) ? 60 : blockKey;

  return { version: ver.version, iv, jmax, wmax, fields: o };
}

module.exports = { readBP2Settings, detectVersion, VERSION_NAMES };
