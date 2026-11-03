# Chess Training AUTO — Stockfish sur iPhone 16 Pro

**Architecture :** échiquier d'entraînement Chrome → FEN automatiquement reconstituée → canal ntfy → Stockfish 19 Lite exécuté dans Safari iPhone → canal ntfy de réponse → flèche et cases surlignées automatiquement dans l'onglet Chrome.

Pas de Telegram, pas de Python. Aucun clic « Scanner » après chaque coup.

## Installation
1. Sur iPhone 16 Pro, ouvrir **https://drazo0x-svg.github.io/chess-iphone-telegram/** dans Safari.
2. Générer un canal aléatoire, le copier, puis appuyer sur **Démarrer l'écoute**. Garder Safari ouvert au premier plan et l'iPhone éveillé.
3. Sur PC, télécharger https://github.com/drazo0x-svg/chess-iphone-telegram/archive/refs/heads/main.zip et extraire l'archive.
4. Chrome → `chrome://extensions` → Mode développeur → Charger l'extension non empaquetée → choisir **extension**.
5. Si l'extension existait déjà, la **recharger** depuis `chrome://extensions`, puis actualiser la page d'échecs.
6. Ouvrir son popup une fois pour coller le canal de l'iPhone et activer **Analyse automatique**.
7. Ouvrir l'échiquier d'entraînement sur Chess.com ou Lichess. Après chaque changement de position reconnu, l'extension calcule l'état au trait et envoie une FEN. La réponse apparaît comme une flèche sur l'échiquier, même si le popup est fermé.

## Particularités
- Le moteur analyse le **camp au trait après le dernier coup** (l'adversaire du joueur qui vient de jouer).
- À l'ouverture au milieu d'une partie, le camp au trait est potentiellement inconnu : le choisir dans le popup ; idéalement commencer depuis la position initiale.
- La FEN est reconstruite à partir des pièces et du suivi de leurs déplacements. Les droits de roque, prise en passant et les compteurs ne sont **pas garantis** si la partie était déjà commencée au moment du chargement.
- Si l'échiquier ou la manière dont le site dessine les pièces change, la détection peut échouer. Ce système n'utilise pas d'OCR.
- La flèche et les cases colorées sont ajoutées dans la page du navigateur, avec un petit indicateur d'état en bas à droite.
- Safari doit rester ouvert et actif : iOS ne garantit pas l'exécution continue de JavaScript en arrière-plan.
- Le relai utilise ntfy.sh sans authentification : choisir un canal long et aléatoire, ne jamais transmettre de données privées.
- Usage réservé aux exercices, analyses de parties terminées et parties où l'assistance est autorisée.
