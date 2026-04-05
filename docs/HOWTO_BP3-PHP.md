# HOWTO — BP3 interface PHP (Windows/MAMP)

Guide d'utilisation de Bol Processor 3 via l'interface PHP sur Windows.
Source : [bolprocessor.org/install](https://bolprocessor.org/install/)

---

## 1. Prérequis

- **MAMP** (gratuit) : [mamp.info](https://www.mamp.info/)
- **BolProcessorInstaller.exe** : [bolprocessor.org/misc/BolProcessorInstaller.exe](https://bolprocessor.org/misc/BolProcessorInstaller.exe)
- **MinGW** (optionnel, pour compiler bp.exe) : [bolprocessor.org/install-mingw](https://bolprocessor.org/install-mingw/)
- **Csound 6.18.1** (optionnel) : [csound.com/download.html](https://csound.com/download.html)

## 2. Installation

1. Installer MAMP → crée `C:\MAMP\htdocs\`
2. Lancer `BolProcessorInstaller.exe` → crée `C:\MAMP\htdocs\bolprocessor\`
3. Structure résultante :
   ```
   C:\MAMP\htdocs\bolprocessor\
   ├── bp.exe              # Console BP3 (moteur C compilé)
   ├── php/                # Interface web PHP
   ├── source/             # Code source C
   ├── ctests/             # Exemples et grammaires de test
   ├── csound_resources/   # Ressources Csound
   ├── console_strings.json
   ├── Makefile
   └── ...
   ```

## 3. Démarrage

### Lancer le serveur

```
C:\MAMP\bin\mamp\MAMP.exe
```

> Si `LauncherMAMP.exe` ne fonctionne pas, lancer `MAMP.exe` directement.
> Vérifier que Apache est actif (voyant vert) et que le **port 80** est utilisé.

### Alternative : serveur PHP intégré (sans MAMP)

```bash
"C:\MAMP\bin\php\php8.3.1\php.exe" -S localhost:8080 -t "C:\MAMP\htdocs\bolprocessor\php"
```
Puis ouvrir `http://localhost:8080/`

### Ouvrir l'interface

```
http://localhost/bolprocessor/php/
```

> Important : HTTP, pas HTTPS.

## 4. Charger une grammaire

1. Sur la page d'accueil, naviguer dans les dossiers (ex: **ctests/**)
2. Cliquer sur un fichier grammaire (suffixe `-gr`)
3. La page affiche le contenu et les fichiers associés en bas :

| Suffixe | Type | Description |
|---------|------|-------------|
| `-gr` | Grammaire | Règles de production |
| `-al` | Alphabet | Définition des sound-objects |
| `-se` | Settings | Paramètres de configuration |
| `-da` | Data | Données musicales / scores |
| `-so` | Prototypes | Prototypes de sound-objects (durées) |

## 5. Produire de la musique

1. Ouvrir une grammaire (`-gr`)
2. Cliquer sur **PRODUCE ITEM(s)**
3. La console `bp.exe` s'exécute et génère la sortie

### Formats de sortie

- **Real-time MIDI** — sortie directe vers un synthétiseur
- **MIDI file** — fichier `.mid` avec lecteur intégré
- **Csound score** — fichier son via Csound → lecteur HTML5

### Options utiles

- **Trace production** — affiche les étapes de dérivation
- **Non-stop improvisation** — génération continue de phrases
- **Graphics** — visualisation piano roll ou sound-objects
- **Compilation checking** — validation de la syntaxe et des terminaux

## 6. Importer ses propres fichiers

- Utiliser le bouton **IMPORT FILES** dans l'interface (pas l'explorateur Windows)
- Cela préserve les permissions (775) nécessaires au bon fonctionnement
- On peut créer ses propres workspaces plutôt que modifier ctests/

## 7. MusicXML

L'interface peut importer du **MusicXML** (partitions) et le convertir en expressions polymétriques BP3.

## 8. Déplacer les données hors de MAMP

Pour installer les données sur un autre disque (ex: `D:\MUSIC\bolprocessor`) :

```cmd
cmd /c mklink /J "C:\MAMP\htdocs\bolprocessor" "D:\MUSIC\bolprocessor"
```

> Utiliser `/J` (junction), pas `/D`. Le nom du dossier doit rester `bolprocessor`.

## 9. Mise à jour

Relancer `BolProcessorInstaller.exe` pour obtenir les dernières versions.
Les données utilisateur sont préservées, mais les fichiers ctests/ sont restaurés à la version distributive.

## 10. Dépannage

| Problème | Solution |
|----------|----------|
| LauncherMAMP.exe se ferme | Lancer `C:\MAMP\bin\mamp\MAMP.exe` directement |
| Page inaccessible | Vérifier port 80 dans MAMP, utiliser HTTP (pas HTTPS) |
| "gcc is not responding" | Installer MinGW, recharger la page d'accueil BP3 |
| Csound non détecté | Installer Csound 6.18.1 64-bit, l'interface détecte auto le chemin |

## Références

- [bolprocessor.org/install](https://bolprocessor.org/install/)
- [bolprocessor.org/quick-install-windows](https://bolprocessor.org/quick-install-windows/)
- [bolprocessor.org/check-bp3](https://bolprocessor.org/check-bp3/)
- Code source : [github.com/bolprocessor](https://github.com/bolprocessor)
