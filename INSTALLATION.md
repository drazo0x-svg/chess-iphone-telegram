# Chess iPhone 16 Pro + Telegram (sans Python)

Projet d'entraînement aux échecs : extension Chrome → relais ntfy → analyse locale Stockfish (Safari iPhone) → bot Telegram.

## Sécurité
Le **token Telegram montré dans la capture doit être révoqué** dans @BotFather avec `/revoke`. Ne publiez aucun token dans ce dépôt public, fichier JavaScript, URL ou issue.

## Étapes pour terminer l'installation
1. Télécharger les fichiers officiels GPL-3.0 :
   - https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/stockfish-19-lite-single.js
   - https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/stockfish-19-lite-single.wasm
2. Les téléverser à la **racine** du dépôt (à côté de index.html et app.js), sans les renommer.
3. Ouvrir GitHub → Settings → Pages → Source: Deploy from a branch → Branch: main → Folder: /(root) → Save.
4. Ouvrir https://drazo0x-svg.github.io/chess-iphone-telegram/ sur l'iPhone 16 Pro via Safari.
5. Dans @BotFather, révoquer l'ancien token, puis copier le nouveau dans Safari, jamais dans GitHub.
6. Dans Telegram, envoyer /start au bot. Pour connaître le Chat ID, consulter la réponse de getUpdates via une session privée et ne partager ni URL ni réponse contenant le token.
7. Générer un canal aléatoire sur la page Safari et le reporter dans l'extension Chrome.
8. Ouvrir la page Safari au premier plan, appuyer sur Démarrer l'écoute. Essayer Tester Telegram, puis Analyser cette position.

## Extension Chrome
L'extension du ZIP précédent est à installer avec chrome://extensions → Mode développeur → Charger l'extension non empaquetée. Elle se trouve dans le dossier `extension/` du ZIP, distinct de ce site. Sa lecture DOM est expérimentale ; collez une FEN de préférence.

## Limites
- Le site est statique : GitHub Pages n'exécute **pas** Stockfish côté serveur ; Safari exécute Stockfish en WebAssembly et doit rester au premier plan.
- Sans les deux fichiers Stockfish, la page s'affiche mais ne peut pas calculer.
- Le relais ntfy.sh transporte les FEN et peut être lu par toute personne connaissant le canal. Utiliser un canal aléatoire.
- Le token Telegram est sauvegardé dans le stockage local du navigateur iPhone ; ne prêtez pas l'appareil déverrouillé.
- Le navigateur peut rencontrer des restrictions réseau/CORS sur l'API Telegram ; utilisez le bouton Tester Telegram pour vérifier.
- Aucune analyse OCR d'image ; réservé à l'étude et aux parties où l'assistance est autorisée.
