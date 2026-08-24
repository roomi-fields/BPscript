/**
 * LES REFUS DE LA PUBLICATION — DES FONCTIONS PURES QUI REÇOIVENT LES FAITS.
 *
 * ⛔ POURQUOI ELLES SONT SÉPARÉES DU SCRIPT QUI PUBLIE. Trouvé par runtime-OSC le 2026-08-24 :
 * ses dix-sept injections éprouvaient le GARDE, et **aucune n'exerçait les refus de la PUBLICATION
 * elle-même** — assiette non déclarée, arbre sale, commit déjà publié. **Seul appelant : la
 * publication.** ⇒ *« Écrits, soignés, jamais tournés. »*
 *
 * ⇒ **LE REMÈDE N'EST PAS D'EXTRAIRE POUR POUVOIR APPELER, C'EST DE DONNER LES FAITS.** Une décision
 * qui va CHERCHER ses propres faits ne s'éprouve pas : pour l'exercer il faut fabriquer un dépôt sale,
 * un artefact déjà publié, un lien mort. **Ici la décision ne mesure rien** — elle reçoit ce qui a été
 * mesuré, et un banc lui passe des faits fabriqués sans qu'aucun disque ne bouge.
 *
 * ⚠️ ET C'EST MIEUX QU'UN MODE `--essai`. Mes deux autres écriveurs en ont un — `--verifier` sur la
 * carte, `--essai` sur le convertisseur, ce dernier ajouté APRÈS qu'il m'a créé cinq fichiers dans
 * `lib/` pendant une simple mesure. **Un mode rend le script mesurable ; séparer la décision rend le
 * mode inutile.**
 *
 * ⛔ CHAQUE FONCTION REND `null` OU UN MESSAGE. Jamais un booléen : un refus qui ne dit pas pourquoi
 * envoie son lecteur chercher, et un champ vide se remplit tout seul — mesuré par kanopi et
 * bp3-frontend le 2026-08-24, sur un verdict qui rendait « cause non extraite » et dont **deux
 * dépôts ont tiré des lectures opposées, chacun celle qui confirmait son propre reproche.**
 */

/**
 * ⛔ UN FAIT QUI MANQUE N'EST PAS UN FAIT QUI VA BIEN — et ce module l'a écrit QUATRE FOIS.
 *
 * Sur des faits absents, quatre de ces refus rendaient `null` : « arbre propre », « rien de
 * publié », « le nom est libre », « le lien est dans la racine ». Un `undefined` replié sur une
 * valeur neutre a **exactement la forme d'une mesure qui n'a rien trouvé** — c'est le TROISIÈME
 * état, celui que ce dépôt a retiré de `documented` et de `PLACES` le même jour.
 *
 * ⚠️ ET LE REMÈDE SE POSE SUR L'ESPACE, PAS SUR L'ENDROIT OÙ IL A MORDU. Réparer les quatre à la
 * main laisserait le cinquième refus l'écrire à nouveau : **le témoin est ici, et chaque refus
 * déclare les faits qu'il EXIGE**. Un fait non mesuré devient alors un refus, jamais un silence.
 */
function faitsManquants(faits, exiges) {
  const absents = exiges.filter(([nom, forme]) => !forme(faits[nom]));
  if (!absents.length) return null;
  return `${absents.map(([n]) => `« ${n} »`).join(', ')} n'a pas été MESURÉ — un fait absent n'est `
    + `pas un fait qui va bien, et un repli sur une valeur neutre rend « rien à signaler » sans `
    + `avoir regardé.`;
}
const LISTE = (v) => Array.isArray(v);
const TEXTE = (v) => typeof v === 'string' && v.length > 0;
const OUI_NON = (v) => typeof v === 'boolean';

/**
 * L'ASSIETTE DÉCLARÉE CORRESPOND À LA CONSTRUCTION — dans les deux sens.
 *
 * ⚠️ L'écart EN TROP n'est pas symétrique de l'écart MANQUANT, et le message le dit : un fichier
 * manquant fait publier un chemin mort, un fichier en trop fait publier ce qu'aucune porte n'ouvre.
 * **Un périmètre trop étroit coûte un mensonge ; trop large, un « modifié » réparable.**
 */
export function refuserAssiette({ derivee, declaree }) {
  const absent = faitsManquants({ derivee, declaree }, [['derivee', LISTE], ['declaree', LISTE]]);
  if (absent) return absent;
  if (!derivee.length) {
    return "l'assiette dérivée est VIDE — le calcul n'a examiné aucune porte, et un périmètre vide "
      + 'publierait un paquet sans contenu en rendant « aucun écart ».';
  }
  const manquants = derivee.filter((f) => !declaree.includes(f));
  const enTrop = declaree.filter((f) => !derivee.includes(f));
  if (!manquants.length && !enTrop.length) return null;
  const bouts = [];
  if (manquants.length) bouts.push(`MANQUENT — le paquet publierait un chemin mort : ${manquants.join(', ')}`);
  if (enTrop.length) bouts.push(`EN TROP — le paquet embarque ce qu'aucune porte n'ouvre : ${enTrop.join(', ')}`);
  return `l'assiette déclarée ne correspond pas à la construction. ${bouts.join(' · ')}`;
}

/**
 * L'ARBRE EST PROPRE — sinon l'artefact porte un état que personne ne peut retrouver.
 *
 * ⛔ ET LE PÉRIMÈTRE EST CELUI DE L'ASSIETTE, PAS DU DÉPÔT. Un document modifié n'entre pas dans le
 * paquet : refuser dessus ferait payer à la publication ce qu'elle ne publie pas. **Kanopi a passé
 * une matinée bloquée par des arbres sales dont la saleté ne touchait pas ce qu'elle consomme.**
 */
export function refuserArbreSale({ modifies, assiette }) {
  // Le premier des quatre à avoir rendu « arbre propre » sur des faits absents — trouvé par le banc
  // AVANT la première publication. Le témoin commun le tient maintenant, comme les cinq autres.
  const absent = faitsManquants({ modifies, assiette }, [['modifies', LISTE], ['assiette', LISTE]]);
  if (absent) return absent;
  const dansLAssiette = modifies.filter((f) => assiette.includes(f));
  if (!dansLAssiette.length) return null;
  return `${dansLAssiette.length} fichier(s) de l'assiette ne sont pas enregistrés : `
    + `${dansLAssiette.join(', ')}. L'artefact porterait un état que personne ne peut retrouver — `
    + `son nom serait un commit, et son contenu autre chose.`;
}

/**
 * UN COMMIT DÉJÀ PUBLIÉ NE SE RECONSTRUIT PAS.
 *
 * Le nom d'un paquet EST son commit : refaire le dossier sous ce nom en changerait le contenu, et
 * **deux contenus auraient porté le même nom**. L'immuabilité tombe alors en silence.
 */
export function refuserCommitDejaPublie({ commit, publies }) {
  if (!commit) return 'aucun commit à publier — la révision courante est introuvable.';
  const absent = faitsManquants({ publies }, [['publies', LISTE]]);
  if (absent) return absent;
  if (!publies.includes(commit)) return null;
  return `le commit ${commit} est DÉJÀ publié. Le nom d'un paquet est son commit : le reconstruire `
    + `ferait porter deux contenus au même nom, et l'immuabilité tomberait sans un mot. `
    + `Ce qui se rebascule est le LIEN, jamais le dossier.`;
}

/**
 * LE NOM DU PAQUET EST LIBRE — et un nom de paquet est un commit ABRÉGÉ.
 *
 * ⛔ CE REFUS N'EST PAS DANS LE PATRON, ET C'EST UN TROU MESURÉ. Le patron protège « un commit déjà
 * publié ne se reconstruit pas » ; il ne protège pas le cas inverse — **un NOM déjà pris par un
 * AUTRE commit**. Or le nom d'un dossier est l'abrégé, les abrégés se collisionnent, et la longueur
 * de l'abrégé grandit avec le dépôt. Reconstruire sous un nom occupé donnerait exactement ce que
 * l'immuabilité interdit : **deux contenus ayant porté un même nom**.
 *
 * ⚠️ UN DOSSIER SANS EMPREINTE LISIBLE MORD AUSSI. C'est une construction interrompue ou abîmée :
 * la remplacer en silence ferait porter au nom un contenu dont personne ne sait ce qu'il était.
 * **Un fait absent n'est pas un fait qui va bien.**
 */
export function refuserNomDejaPris({ nom, cibleExiste, commitDuNom, commit }) {
  const absent = faitsManquants({ nom, cibleExiste, commit },
    [['nom', TEXTE], ['cibleExiste', OUI_NON], ['commit', TEXTE]]);
  if (absent) return absent;
  if (!cibleExiste) return null;
  if (commitDuNom === commit) return null;
  if (!commitDuNom) {
    return `le dossier ${nom} existe DÉJÀ et ne porte aucune empreinte lisible — construction `
      + `interrompue ou abîmée. Le remplacer ferait porter ce nom à un contenu dont personne ne `
      + `sait ce qu'il était. Retire-le à la main, en connaissance de cause.`;
  }
  return `le nom ${nom} est DÉJÀ PRIS par le commit ${commitDuNom}, et je publie ${commit}. Un nom `
    + `de paquet est un commit ABRÉGÉ, et les abrégés se collisionnent : construire ici ferait `
    + `porter un même nom à deux contenus, et l'immuabilité tomberait sans un mot.`;
}

/**
 * L'EMPREINTE DIT LA VÉRITÉ — le commit courant, un arbre propre, un compte non nul.
 *
 * ⚠️ LE COMPTE NON NUL EST LE TÉMOIN ANTI-VACUITÉ : zéro fichier rendrait toute comparaison verte en
 * ne regardant RIEN. C'est le troisième filet de Kronos, et il vaut ici comme ailleurs.
 */
export function refuserEmpreinte({ empreinte, commitAttendu }) {
  if (!empreinte) return "aucune empreinte gravée — le paquet ne dit pas d'où il vient.";
  if (!empreinte.commit) return "l'empreinte ne porte pas de commit — elle ne se rejoue pas.";
  const absent = faitsManquants({ commitAttendu }, [['commitAttendu', TEXTE]]);
  if (absent) return absent;
  if (empreinte.commit !== commitAttendu) {
    return `l'empreinte porte ${empreinte.commit} et la construction a eu lieu à ${commitAttendu} — `
      + `la gravure a visé à côté, et le paquet annonce un état qu'il ne contient pas.`;
  }
  if (!empreinte.fichiers) {
    return "l'empreinte annonce ZÉRO fichier — une comparaison sur un paquet vide est verte en ne "
      + 'regardant rien.';
  }
  return null;
}

/**
 * LE LIEN MÈNE À UN PAQUET QUI EXISTE — sinon le consommateur lit un chemin mort.
 *
 * ⚠️ ET UN LIEN QUI POINTE UN ARBRE DE TRAVAIL NE PUBLIE RIEN : *tant que la résolution passe par un
 * lien vers l'arbre, paquet et source désignent le même disque.* Mesuré par runtime-MIDI.
 */
export function refuserLien({ lien, cible, cibleExiste, racinePaquets }) {
  if (!lien) return 'aucun lien de paquet — un consommateur n\'a rien à résoudre.';
  if (!cible) return `le lien ${lien} ne désigne rien.`;
  const absent = faitsManquants({ cibleExiste, racinePaquets },
    [['cibleExiste', OUI_NON], ['racinePaquets', TEXTE]]);
  if (absent) return absent;
  if (!cibleExiste) return `le lien ${lien} mène à ${cible}, qui n'existe pas — un chemin mort.`;
  if (!cible.startsWith(racinePaquets)) {
    return `le lien ${lien} mène à ${cible}, HORS de la racine des paquets — tant que la résolution `
      + `passe par un arbre de travail, paquet et source désignent le même disque et rien n'est publié.`;
  }
  return null;
}

/**
 * LES REFUS SE POSENT EN DEUX TEMPS, ET CE N'EST PAS UN DÉTAIL D'ORGANISATION.
 *
 * ⛔ TROIS SE POSENT AVANT QUE QUOI QUE CE SOIT EXISTE — sur ce que le dépôt dit de lui-même. Les
 * DEUX AUTRES se posent sur l'ARTEFACT, qui n'existe pas encore quand les premiers parlent. **Une
 * fonction unique qui les poserait tous ensemble mentirait sur l'ordre** : elle ferait croire qu'on
 * peut vérifier une empreinte avant de l'avoir gravée, et la publication ne l'appellerait jamais —
 * elle deviendrait une fonction dont le seul appelant est son banc.
 */

/** Les trois refus posés AVANT la construction. Rend la liste des messages. */
export function refusAvantConstruction(faits) {
  return [
    refuserAssiette(faits.assiette || {}),
    refuserArbreSale(faits.arbre || {}),
    refuserCommitDejaPublie(faits.commit || {}),
    refuserNomDejaPris(faits.nom || {}),
  ].filter(Boolean);
}

/** Les deux refus posés SUR L'ARTEFACT, une fois qu'il existe. Rend la liste des messages. */
export function refusApresConstruction(faits) {
  return [
    refuserEmpreinte(faits.empreinte || {}),
    refuserLien(faits.lien || {}),
  ].filter(Boolean);
}
